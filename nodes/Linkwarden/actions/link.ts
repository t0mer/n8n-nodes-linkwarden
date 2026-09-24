import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { paginate } from '../../../shared/paginate';
import { parseId } from '../../../shared/locators';
import { linkwardenRequest } from '../../../shared/transport';
import type { Link } from '../../../shared/types';
import {
	hintOnHardLimit,
	linkFilterQs,
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

export const linkOperations: Record<string, OperationHandler> = { get, getAll, search };
