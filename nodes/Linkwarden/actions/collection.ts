import { NodeOperationError, type IDataObject, type IExecuteFunctions } from 'n8n-workflow';

import {
	collectionPaths,
	getAllCollections,
	readLocator,
	resolveCollectionId,
} from '../../../shared/locators';
import { linkwardenRequest } from '../../../shared/transport';
import type { Collection } from '../../../shared/types';
import {
	fetchCollection,
	getLocator,
	requestOptions,
	toItems,
	type OperationHandler,
} from './utils';

const STYLE_FIELDS = ['description', 'color', 'icon', 'iconWeight'] as const;

async function collectionIdParam(ctx: IExecuteFunctions, i: number): Promise<number> {
	const locator = getLocator(ctx, 'collection', i);
	if (!locator) {
		throw new NodeOperationError(ctx.getNode(), 'Select a collection', { itemIndex: i });
	}
	return await resolveCollectionId(ctx, locator, i);
}

/**
 * Full `PUT /api/v1/collections/{id}` body. The server requires `members` and replaces all
 * members with it, so the current members are echoed unchanged to keep sharing intact.
 * An absent `parentId` keeps the parent; `"root"` moves the collection to the top level.
 */
export function buildCollectionUpdateBody(current: Collection, changes: IDataObject): IDataObject {
	const body: IDataObject = {
		id: current.id,
		name: changes.name ?? current.name,
		description: changes.description ?? current.description ?? '',
		color: changes.color ?? current.color ?? undefined,
		icon: changes.icon ?? current.icon ?? null,
		iconWeight: changes.iconWeight ?? current.iconWeight ?? null,
		isPublic: changes.isPublic ?? current.isPublic ?? false,
		members: (current.members ?? []).map((member) => ({
			userId: member.userId,
			canCreate: member.canCreate,
			canUpdate: member.canUpdate,
			canDelete: member.canDelete,
		})),
	};
	if (changes.parentId !== undefined) body.parentId = changes.parentId;
	if (body.color === undefined) delete body.color;
	return body;
}

const create: OperationHandler = async function (i) {
	const name = (this.getNodeParameter('name', i) as string).trim();
	const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const body: IDataObject = { name };
	for (const field of STYLE_FIELDS) {
		if (typeof fields[field] === 'string' && fields[field] !== '') body[field] = fields[field];
	}
	const parent = readLocator(fields.parent);
	if (parent) body.parentId = await resolveCollectionId(this, parent, i, 'Parent Collection');

	// The OpenAPI spec documents POST /collections/{id}; the real route is POST /collections.
	return toItems(
		await linkwardenRequest<Collection>(
			this,
			'POST',
			'/api/v1/collections',
			requestOptions(this, i, { body }),
		),
	);
};

const get: OperationHandler = async function (i) {
	return toItems(await fetchCollection(this, await collectionIdParam(this, i), i));
};

const getAll: OperationHandler = async function (i) {
	const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
	const limit = this.getNodeParameter('limit', i, 50) as number;
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;

	let collections = await getAllCollections(this, i);
	const parent = readLocator(filters.parent);
	if (parent) {
		const parentId = await resolveCollectionId(this, parent, i, 'Parent Collection');
		collections = collections.filter((c) => (c.parentId ?? c.parent?.id) === parentId);
	} else if (filters.topLevelOnly === true) {
		collections = collections.filter((c) => (c.parentId ?? c.parent?.id ?? null) === null);
	}
	const paths = collectionPaths(collections);
	const output = collections.map((c) => ({ ...c, path: paths.get(c.id) ?? c.name }));
	return toItems(returnAll ? output : output.slice(0, limit));
};

const update: OperationHandler = async function (i) {
	const id = await collectionIdParam(this, i);
	const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

	const changes: IDataObject = {};
	if (typeof fields.name === 'string' && fields.name.trim()) changes.name = fields.name.trim();
	for (const field of STYLE_FIELDS) {
		if (typeof fields[field] === 'string') changes[field] = fields[field];
	}
	if (typeof fields.isPublic === 'boolean') changes.isPublic = fields.isPublic;
	const parent = readLocator(fields.parent);
	if (parent) {
		changes.parentId = await resolveCollectionId(this, parent, i, 'Parent Collection');
	} else if (fields.moveToTopLevel === true) {
		changes.parentId = 'root';
	}
	if (Object.keys(changes).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
			itemIndex: i,
		});
	}

	const current = await fetchCollection(this, id, i);
	return toItems(
		await linkwardenRequest<Collection>(
			this,
			'PUT',
			`/api/v1/collections/${id}`,
			requestOptions(this, i, { body: buildCollectionUpdateBody(current, changes) }),
		),
	);
};

const deleteCollection: OperationHandler = async function (i) {
	const id = await collectionIdParam(this, i);
	await linkwardenRequest(
		this,
		'DELETE',
		`/api/v1/collections/${id}`,
		requestOptions(this, i, { messages: { 404: `Collection ${id} not found` } }),
	);
	return toItems({ id, deleted: true });
};

export const collectionOperations: Record<string, OperationHandler> = {
	create,
	delete: deleteCollection,
	get,
	getAll,
	update,
};
