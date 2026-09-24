import type { IDataObject, IPollFunctions } from 'n8n-workflow';

import { MAX_ITEMS } from './constants';
import { getAllCollections } from './locators';
import { toPage } from './paginate';
import { linkwardenRequest } from './transport';
import type { Link } from './types';

export const MANUAL_SAMPLE_SIZE = 5;

export interface TriggerFilters {
	collectionId?: number;
	tagId?: number;
	includeSubcollections: boolean;
}

export interface TriggerState extends IDataObject {
	version: 1;
	filterKey: string;
	lastSeenId: number;
	lastPollAt: string;
}

export interface PollResult {
	/** New links, oldest first. */
	links: Link[];
	/** More than `maxPerPoll` new links arrived; only the newest were returned. */
	truncated: boolean;
}

export function filterKeyOf(filters: TriggerFilters): string {
	return JSON.stringify({
		collectionId: filters.collectionId ?? null,
		tagId: filters.tagId ?? null,
		includeSubcollections: filters.collectionId !== undefined && filters.includeSubcollections,
	});
}

/** Ids of a collection and all its descendants. */
async function collectionTree(ctx: IPollFunctions, rootId: number): Promise<Set<number>> {
	const collections = await getAllCollections(ctx);
	const ids = new Set([rootId]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const c of collections) {
			const parentId = c.parentId ?? c.parent?.id;
			if (parentId !== undefined && parentId !== null && ids.has(parentId) && !ids.has(c.id)) {
				ids.add(c.id);
				grew = true;
			}
		}
	}
	return ids;
}

function filterQs(filters: TriggerFilters): IDataObject {
	const qs: IDataObject = { sort: 0 };
	if (filters.collectionId !== undefined && !filters.includeSubcollections) {
		qs.collectionId = filters.collectionId;
	}
	if (filters.tagId !== undefined) qs.tagId = filters.tagId;
	return qs;
}

/**
 * Walks links newest-first through `GET /api/v1/search` without a query (the listing route
 * `GET /api/v1/links` is deprecated). `visit` returns false to stop.
 */
async function walkNewestFirst(
	ctx: IPollFunctions,
	qs: IDataObject,
	tree: Set<number> | undefined,
	visit: (link: Link, matches: boolean) => boolean,
): Promise<void> {
	let scanned = 0;
	let cursor: unknown;
	while (scanned < MAX_ITEMS) {
		const data = await linkwardenRequest<unknown>(ctx, 'GET', '/api/v1/search', {
			qs: cursor === undefined ? qs : { ...qs, cursor },
		});
		const page = toPage<Link>(data, 'links');
		for (const link of page.items) {
			scanned++;
			const collectionId = link.collection?.id ?? link.collectionId;
			const matches = !tree || (collectionId !== undefined && tree.has(collectionId));
			if (!visit(link, matches)) return;
		}
		if (page.nextCursor === null || page.nextCursor === undefined || page.nextCursor === cursor) {
			return;
		}
		cursor = page.nextCursor;
	}
}

async function subcollectionTree(
	ctx: IPollFunctions,
	filters: TriggerFilters,
): Promise<Set<number> | undefined> {
	return filters.collectionId !== undefined && filters.includeSubcollections
		? await collectionTree(ctx, filters.collectionId)
		: undefined;
}

/** Manual "Fetch Test Event": the newest matching links, oldest first. Touches no state. */
export async function sampleLinks(ctx: IPollFunctions, filters: TriggerFilters): Promise<Link[]> {
	const links: Link[] = [];
	const tree = await subcollectionTree(ctx, filters);
	await walkNewestFirst(ctx, filterQs(filters), tree, (link, matches) => {
		if (matches) links.push(link);
		return links.length < MANUAL_SAMPLE_SIZE;
	});
	return links.reverse();
}

/**
 * Detects new links by id (monotonic; `createdAt` can be old for imports). The first poll,
 * or a poll after the filters changed, records the newest id and emits nothing. State is
 * only written after every request succeeded.
 */
export async function pollNewLinks(
	ctx: IPollFunctions,
	staticData: IDataObject,
	filters: TriggerFilters,
	maxPerPoll: number,
	now: Date = new Date(),
): Promise<PollResult> {
	const filterKey = filterKeyOf(filters);
	const seeded =
		staticData.version === 1 &&
		staticData.filterKey === filterKey &&
		typeof staticData.lastSeenId === 'number';
	const lastSeenId = seeded ? (staticData.lastSeenId as number) : 0;

	let newestId = lastSeenId;
	const fresh: Link[] = [];
	if (!seeded) {
		// Seed from the newest link overall, not the newest matching one: otherwise links
		// that later move into the filtered collection or get the tag would fire as new.
		await walkNewestFirst(ctx, { sort: 0 }, undefined, (link) => {
			newestId = link.id;
			return false;
		});
	} else {
		const tree = await subcollectionTree(ctx, filters);
		await walkNewestFirst(ctx, filterQs(filters), tree, (link, matches) => {
			if (link.id <= lastSeenId) return false;
			newestId = Math.max(newestId, link.id);
			if (matches) fresh.push(link);
			// One extra match tells us whether we truncated.
			return fresh.length <= maxPerPoll;
		});
	}

	const state: TriggerState = {
		version: 1,
		filterKey,
		lastSeenId: newestId,
		lastPollAt: now.toISOString(),
	};
	Object.assign(staticData, state);

	if (!seeded) return { links: [], truncated: false };
	const truncated = fresh.length > maxPerPoll;
	return { links: fresh.slice(0, maxPerPoll).reverse(), truncated };
}
