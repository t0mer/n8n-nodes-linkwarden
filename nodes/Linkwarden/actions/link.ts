import { NodeOperationError, type IDataObject, type IExecuteFunctions } from 'n8n-workflow';

import { FIND_BY_URL_MAX_PAGES } from '../../../shared/constants';
import {
	buildLinkUpdateBody,
	buildPinBody,
	type LinkChanges,
	type TagMode,
} from '../../../shared/linkUpdate';
import {
	parseId,
	parseIdList,
	parseNameList,
	readLocator,
	resolveCollectionId,
} from '../../../shared/locators';
import { paginate } from '../../../shared/paginate';
import { linkwardenRequest, linkwardenRequestFull } from '../../../shared/transport';
import type { Collection, Link, User } from '../../../shared/types';
import { sameUrl, urlSearchTerm } from '../../../shared/url';
import {
	getLocator,
	hintOnHardLimit,
	linkFilterQs,
	requestOptions,
	toItems,
	type ExecutionCache,
	type OperationHandler,
} from './utils';

export async function fetchLink(
	ctx: IExecuteFunctions,
	linkId: number,
	itemIndex: number,
): Promise<Link> {
	return await linkwardenRequest<Link>(
		ctx,
		'GET',
		`/api/v1/links/${linkId}`,
		requestOptions(ctx, itemIndex, { messages: { 404: `Link ${linkId} not found` } }),
	);
}

const get: OperationHandler = async function (i) {
	const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
	return toItems(await fetchLink(this, linkId, i));
};

async function listLinks(
	ctx: IExecuteFunctions,
	i: number,
	path: string,
	qs: IDataObject,
	kind: 'linksCursor' | 'nextCursor',
) {
	const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
	const limit = ctx.getNodeParameter('limit', i, 50) as number;
	const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
	const sort = ctx.getNodeParameter('sort', i, 0) as number;
	const { itemIndex, maxRetries } = requestOptions(ctx, i);

	const result = await paginate<Link>(
		ctx,
		kind,
		path,
		{ sort, ...qs, ...(await linkFilterQs(ctx, filters, i)) },
		{ returnAll, limit, itemIndex, maxRetries, itemsKey: 'links' },
	);
	hintOnHardLimit(ctx, result);
	return toItems(result.items);
}

const getAll: OperationHandler = async function (i) {
	return await listLinks(this, i, '/api/v1/links', {}, 'linksCursor');
};

const search: OperationHandler = async function (i) {
	const query = (this.getNodeParameter('query', i) as string).trim();
	return await listLinks(this, i, '/api/v1/search', { searchQueryString: query }, 'nextCursor');
};

/**
 * Finds saved links whose URL equals `url` after normalization. Searches for host + path
 * (works with and without Meilisearch) and keeps exact matches from up to 5 pages.
 */
export async function findLinksByUrl(
	ctx: IExecuteFunctions,
	url: string,
	itemIndex: number,
	collectionId?: number,
): Promise<Link[]> {
	const qs: IDataObject = { searchQueryString: urlSearchTerm(url), sort: 0 };
	if (collectionId !== undefined) qs.collectionId = collectionId;
	const { maxRetries } = requestOptions(ctx, itemIndex);
	const { items } = await paginate<Link>(ctx, 'nextCursor', '/api/v1/search', qs, {
		returnAll: true,
		maxPages: FIND_BY_URL_MAX_PAGES,
		itemsKey: 'links',
		itemIndex,
		maxRetries,
	});
	const seen = new Set<number>();
	return items.filter((link) => {
		if (seen.has(link.id) || !sameUrl(link.url, url)) return false;
		seen.add(link.id);
		return true;
	});
}

const findByUrl: OperationHandler = async function (i) {
	const url = (this.getNodeParameter('url', i) as string).trim();
	const scope = getLocator(this, 'scope', i);
	const collectionId = scope ? await resolveCollectionId(this, scope, i) : undefined;
	const matches = await findLinksByUrl(this, url, i, collectionId);
	return toItems({ found: matches.length > 0, matches, link: matches[0] ?? null });
};

type OnDuplicate = 'error' | 'returnExisting' | 'skip';

function duplicateResult(
	ctx: IExecuteFunctions,
	onDuplicate: OnDuplicate,
	url: string,
	existing: Link | undefined,
	i: number,
) {
	if (onDuplicate === 'skip') return [];
	if (onDuplicate === 'error') {
		throw new NodeOperationError(ctx.getNode(), `Link already exists: ${url}`, {
			itemIndex: i,
			description: existing ? `Existing link ID: ${existing.id}` : undefined,
		});
	}
	return toItems(
		existing ? { ...existing, duplicate: true } : { url, duplicate: true, link: null },
	);
}

const create: OperationHandler = async function (i) {
	const url = (this.getNodeParameter('url', i) as string).trim();
	const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const onDuplicate = (options.onDuplicate as OnDuplicate | undefined) ?? 'returnExisting';

	const body: IDataObject = { url, type: 'url' };
	if (typeof fields.name === 'string' && fields.name.trim()) body.name = fields.name.trim();
	if (typeof fields.description === 'string' && fields.description) {
		body.description = fields.description;
	}
	const tags = parseNameList(fields.tags);
	if (tags.length > 0) body.tags = tags.map((name) => ({ name }));
	const collection = readLocator(fields.collection);
	if (collection) body.collection = { id: await resolveCollectionId(this, collection, i) };

	if (options.precheckDuplicate === true) {
		const [existing] = await findLinksByUrl(this, url, i);
		if (existing) return duplicateResult(this, onDuplicate, url, existing, i);
	}

	const response = await linkwardenRequestFull<Link>(
		this,
		'POST',
		'/api/v1/links',
		requestOptions(this, i, { body, allowStatuses: [409] }),
	);
	if (response.statusCode === 409) {
		const existing =
			onDuplicate === 'returnExisting' ? (await findLinksByUrl(this, url, i))[0] : undefined;
		return duplicateResult(this, onDuplicate, url, existing, i);
	}
	return toItems({ ...response.data, duplicate: false });
};

export async function putLink(
	ctx: IExecuteFunctions,
	linkId: number,
	body: IDataObject,
	itemIndex: number,
): Promise<Link> {
	return await linkwardenRequest<Link>(
		ctx,
		'PUT',
		`/api/v1/links/${linkId}`,
		requestOptions(ctx, itemIndex, { body, messages: { 404: `Link ${linkId} not found` } }),
	);
}

const TEXT_FIELDS = ['name', 'url', 'description', 'color', 'icon', 'iconWeight'] as const;

const update: OperationHandler = async function (i) {
	const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
	const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

	const changes: LinkChanges = {};
	for (const field of TEXT_FIELDS) {
		if (typeof fields[field] === 'string') changes[field] = (fields[field] as string).trim();
	}
	if (fields.tags !== undefined) {
		changes.tags = parseNameList(fields.tags);
		changes.tagMode = (fields.tagMode as TagMode | undefined) ?? 'add';
	}
	const target = readLocator(fields.collection);
	if (target) {
		const collectionId = await resolveCollectionId(this, target, i);
		const collection = await linkwardenRequest<Collection>(
			this,
			'GET',
			`/api/v1/collections/${collectionId}`,
			requestOptions(this, i, { messages: { 404: `Collection ${collectionId} not found` } }),
		);
		changes.collection = { id: collection.id, ownerId: collection.ownerId };
	}
	if (Object.keys(changes).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
			itemIndex: i,
		});
	}

	const current = await fetchLink(this, linkId, i);
	return toItems(await putLink(this, linkId, buildLinkUpdateBody(current, changes), i));
};

/** The current user, fetched once per execution. */
export async function currentUser(
	ctx: IExecuteFunctions,
	cache: ExecutionCache,
	itemIndex: number,
): Promise<User> {
	cache.me ??= await linkwardenRequest<User>(
		ctx,
		'GET',
		'/api/v1/users/me',
		requestOptions(ctx, itemIndex),
	);
	return cache.me;
}

function pinHandler(pin: boolean): OperationHandler {
	return async function (i, cache) {
		const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
		const me = await currentUser(this, cache, i);
		const current = await fetchLink(this, linkId, i);
		return toItems(await putLink(this, linkId, buildPinBody(current, me.id, pin), i));
	};
}

const deleteLink: OperationHandler = async function (i) {
	const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
	await linkwardenRequest(
		this,
		'DELETE',
		`/api/v1/links/${linkId}`,
		requestOptions(this, i, { messages: { 404: `Link ${linkId} not found` } }),
	);
	return toItems({ id: linkId, deleted: true });
};

const deleteMany: OperationHandler = async function (i) {
	const linkIds = parseIdList(this, this.getNodeParameter('linkIds', i), 'Link IDs', i);
	const result = await linkwardenRequest<{ count?: number }>(
		this,
		'DELETE',
		'/api/v1/links',
		requestOptions(this, i, { body: { linkIds } }),
	);
	return toItems({ deleted: result?.count ?? linkIds.length, linkIds });
};

export const linkOperations: Record<string, OperationHandler> = {
	create,
	delete: deleteLink,
	deleteMany,
	findByUrl,
	get,
	getAll,
	pin: pinHandler(true),
	search,
	unpin: pinHandler(false),
	update,
};
