import { NodeOperationError, type IDataObject, type IExecuteFunctions } from 'n8n-workflow';

import { parseId, parseIdList, parseNameList } from '../../../shared/locators';
import { paginate } from '../../../shared/paginate';
import { linkwardenRequest } from '../../../shared/transport';
import type { Tag } from '../../../shared/types';
import {
	getLocator,
	hintOnHardLimit,
	requestOptions,
	toItems,
	type OperationHandler,
} from './utils';

const PRESERVATION_FIELDS = [
	'archiveAsScreenshot',
	'archiveAsMonolith',
	'archiveAsPDF',
	'archiveAsReadable',
	'archiveAsWaybackMachine',
	'aiTag',
] as const;

function tagIdParam(ctx: IExecuteFunctions, i: number): number {
	const locator = getLocator(ctx, 'tag', i);
	if (!locator) throw new NodeOperationError(ctx.getNode(), 'Select a tag', { itemIndex: i });
	return parseId(ctx, locator.value, 'Tag', i);
}

const notFound = (id: number) => ({ messages: { 404: `Tag ${id} not found` } });

const create: OperationHandler = async function (i) {
	const names = parseNameList(this.getNodeParameter('names', i));
	if (names.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Enter at least one tag name', { itemIndex: i });
	}
	const preservation = this.getNodeParameter('preservation', i, {}) as IDataObject;
	const overrides: IDataObject = {};
	for (const field of PRESERVATION_FIELDS) {
		if (typeof preservation[field] === 'boolean') overrides[field] = preservation[field];
	}
	// Linkwarden's tag create schema uses `label`, not `name`.
	const tags = await linkwardenRequest<Tag[]>(
		this,
		'POST',
		'/api/v1/tags',
		requestOptions(this, i, {
			body: { tags: names.map((label) => ({ label, ...overrides })) },
		}),
	);
	return toItems(tags);
};

const get: OperationHandler = async function (i) {
	const id = tagIdParam(this, i);
	return toItems(
		await linkwardenRequest<Tag>(
			this,
			'GET',
			`/api/v1/tags/${id}`,
			requestOptions(this, i, notFound(id)),
		),
	);
};

const getAll: OperationHandler = async function (i) {
	const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
	const limit = this.getNodeParameter('limit', i, 50) as number;
	const search = (this.getNodeParameter('search', i, '') as string).trim();
	const sort = this.getNodeParameter('sort', i, 0) as number;
	const { maxRetries } = requestOptions(this, i);

	const qs: IDataObject = { sort };
	if (search) qs.search = search;
	const result = await paginate<Tag>(this, 'nextCursor', '/api/v1/tags', qs, {
		returnAll,
		limit,
		itemsKey: 'tags',
		itemIndex: i,
		maxRetries,
	});
	hintOnHardLimit(this, result);
	return toItems(result.items);
};

const rename: OperationHandler = async function (i) {
	const id = tagIdParam(this, i);
	const name = (this.getNodeParameter('newName', i) as string).trim();
	if (!name) throw new NodeOperationError(this.getNode(), 'Enter a new name', { itemIndex: i });
	return toItems(
		await linkwardenRequest<Tag>(
			this,
			'PUT',
			`/api/v1/tags/${id}`,
			requestOptions(this, i, { body: { name }, ...notFound(id) }),
		),
	);
};

const deleteTag: OperationHandler = async function (i) {
	const id = tagIdParam(this, i);
	await linkwardenRequest(
		this,
		'DELETE',
		`/api/v1/tags/${id}`,
		requestOptions(this, i, notFound(id)),
	);
	return toItems({ id, deleted: true });
};

const deleteMany: OperationHandler = async function (i) {
	const tagIds = parseIdList(this, this.getNodeParameter('tagIds', i), 'Tag IDs', i);
	const count = await linkwardenRequest<number>(
		this,
		'DELETE',
		'/api/v1/tags',
		requestOptions(this, i, { body: { tagIds } }),
	);
	return toItems({ deleted: typeof count === 'number' ? count : tagIds.length, tagIds });
};

export const tagOperations: Record<string, OperationHandler> = {
	create,
	delete: deleteTag,
	deleteMany,
	get,
	getAll,
	rename,
};
