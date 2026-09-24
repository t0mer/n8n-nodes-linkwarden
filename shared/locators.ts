import {
	NodeOperationError,
	type IDataObject,
	type INodeParameterResourceLocator,
} from 'n8n-workflow';

import type { Collection } from './types';
import { linkwardenRequest, type LinkwardenContext } from './transport';

/** Parses a positive integer id from a number or numeric string. */
export function parseId(
	ctx: LinkwardenContext,
	value: unknown,
	field: string,
	itemIndex?: number,
): number {
	const text = typeof value === 'string' ? value.trim() : value;
	const id =
		typeof text === 'number' ? text : /^\d+$/.test(String(text ?? '')) ? Number(text) : NaN;
	if (!Number.isSafeInteger(id) || id <= 0) {
		throw new NodeOperationError(
			ctx.getNode(),
			`"${field}" must be a positive whole number, got "${String(value ?? '')}"`,
			{ itemIndex },
		);
	}
	return id;
}

/** Parses a list of ids from an array, a single id, or a comma/space-separated string. */
export function parseIdList(
	ctx: LinkwardenContext,
	value: unknown,
	field: string,
	itemIndex?: number,
): number[] {
	const parts = Array.isArray(value)
		? value
		: typeof value === 'number'
			? [value]
			: String(value ?? '')
					.split(/[\s,]+/)
					.filter((part) => part !== '');
	const ids = parts.map((part) => parseId(ctx, part, field, itemIndex));
	if (ids.length === 0) {
		throw new NodeOperationError(ctx.getNode(), `"${field}" needs at least one ID`, { itemIndex });
	}
	return [...new Set(ids)];
}

/** Parses a list of names from an array or a comma-separated string. Trims and drops empties. */
export function parseNameList(value: unknown): string[] {
	const parts = Array.isArray(value) ? value.map(String) : String(value ?? '').split(',');
	return parts.map((part) => part.trim()).filter((part) => part !== '');
}

export interface LocatorValue {
	mode: string;
	value: string;
}

/** Normalizes a resourceLocator parameter value. Empty value = not set. */
export function readLocator(raw: unknown): LocatorValue | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined;
	if (typeof raw === 'object' && 'mode' in (raw as IDataObject)) {
		const rl = raw as INodeParameterResourceLocator;
		const value = String(rl.value ?? '').trim();
		return value === '' ? undefined : { mode: rl.mode, value };
	}
	const value = String(raw).trim();
	return value === '' ? undefined : { mode: 'id', value };
}

/** Builds `Parent / Child` paths for every collection. */
export function collectionPaths(collections: Collection[]): Map<number, string> {
	const byId = new Map(collections.map((c) => [c.id, c]));
	const paths = new Map<number, string>();
	const pathOf = (collection: Collection, seen: Set<number>): string => {
		const cached = paths.get(collection.id);
		if (cached !== undefined) return cached;
		const parentId = collection.parentId ?? collection.parent?.id ?? null;
		const parent = parentId !== null ? byId.get(parentId) : undefined;
		const path =
			parent && !seen.has(parent.id)
				? `${pathOf(parent, new Set([...seen, collection.id]))} / ${collection.name}`
				: collection.name;
		paths.set(collection.id, path);
		return path;
	};
	for (const collection of collections) pathOf(collection, new Set());
	return paths;
}

/** Collections whose name, or full `Parent / Child` path, equals `name` ignoring case. */
export function findCollectionsByName(
	collections: Collection[],
	name: string,
	paths = collectionPaths(collections),
): Collection[] {
	const wanted = name.trim().toLowerCase();
	return collections.filter(
		(c) => c.name.toLowerCase() === wanted || paths.get(c.id)?.toLowerCase() === wanted,
	);
}

export async function getAllCollections(
	ctx: LinkwardenContext,
	itemIndex?: number,
): Promise<Collection[]> {
	return await linkwardenRequest<Collection[]>(ctx, 'GET', '/api/v1/collections', { itemIndex });
}

/**
 * Resolves a collection locator to its id. By Name matches the name, or the full
 * `Parent / Child` path, case-insensitively.
 */
export async function resolveCollectionId(
	ctx: LinkwardenContext,
	locator: LocatorValue,
	itemIndex?: number,
	field = 'Collection',
): Promise<number> {
	if (locator.mode !== 'name') return parseId(ctx, locator.value, field, itemIndex);

	const collections = await getAllCollections(ctx, itemIndex);
	const paths = collectionPaths(collections);
	const matches = findCollectionsByName(collections, locator.value, paths);
	if (matches.length === 0) {
		throw new NodeOperationError(
			ctx.getNode(),
			`No collection named "${locator.value}" was found`,
			{
				itemIndex,
			},
		);
	}
	if (matches.length > 1) {
		const list = matches.map((c) => `${paths.get(c.id)} (ID ${c.id})`).join(', ');
		throw new NodeOperationError(
			ctx.getNode(),
			`More than one collection is named "${locator.value}": ${list}. Select it by ID instead.`,
			{ itemIndex },
		);
	}
	return matches[0].id;
}
