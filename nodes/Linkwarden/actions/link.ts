import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { paginate } from '../../../shared/paginate';
import { parseId, resolveCollectionId } from '../../../shared/locators';
import { FIND_BY_URL_MAX_PAGES } from '../../../shared/constants';
import { sameUrl, urlSearchTerm } from '../../../shared/url';
import { linkwardenRequest } from '../../../shared/transport';
import type { Link } from '../../../shared/types';
import {
	hintOnHardLimit,
	linkFilterQs,
	getLocator,
	requestOptions,
	toItems,
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

export const linkOperations: Record<string, OperationHandler> = { findByUrl, get, getAll, search };
