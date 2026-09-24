import {
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
} from 'n8n-workflow';

import { DEFAULT_MAX_RETRIES } from '../../../shared/constants';
import {
	readLocator,
	resolveCollectionId,
	parseId,
	type LocatorValue,
} from '../../../shared/locators';
import type { PaginateResult } from '../../../shared/paginate';
import { linkwardenRequest, type LinkwardenRequestOptions } from '../../../shared/transport';
import { simplifyLink } from '../../../shared/simplify';
import type { Collection, Link, User } from '../../../shared/types';

/** Per-execution cache shared by all items (e.g. the current user for Pin/Unpin). */
export interface ExecutionCache {
	me?: User;
}

export type OperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
	cache: ExecutionCache,
) => Promise<INodeExecutionData[]>;

export function toItems(data: IDataObject | IDataObject[]): INodeExecutionData[] {
	return (Array.isArray(data) ? data : [data]).map((json) => ({ json }));
}

/** Common request options for an item: item index and the node's retry setting. */
export function requestOptions(
	ctx: IExecuteFunctions,
	itemIndex: number,
	extra: LinkwardenRequestOptions = {},
): LinkwardenRequestOptions {
	const options = ctx.getNodeParameter('requestOptions', itemIndex, {}) as IDataObject;
	const maxRetries =
		typeof options.maxRetries === 'number' ? options.maxRetries : DEFAULT_MAX_RETRIES;
	return { itemIndex, maxRetries, ...extra };
}

export function getLocator(
	ctx: IExecuteFunctions,
	name: string,
	itemIndex: number,
): LocatorValue | undefined {
	return readLocator(ctx.getNodeParameter(name, itemIndex, ''));
}

/** `collectionId` / `tagId` / `pinnedOnly` query filters shared by Get Many, Search and the trigger. */
export async function linkFilterQs(
	ctx: IExecuteFunctions,
	filters: IDataObject,
	itemIndex: number,
): Promise<IDataObject> {
	const qs: IDataObject = {};
	const collection = readLocator(filters.collection);
	if (collection) qs.collectionId = await resolveCollectionId(ctx, collection, itemIndex);
	const tag = readLocator(filters.tag);
	if (tag) qs.tagId = parseId(ctx, tag.value, 'Tag', itemIndex);
	if (filters.pinnedOnly === true) qs.pinnedOnly = 'true';
	return qs;
}

/** Adds an output-pane hint when the 10,000-item hard stop cut results short. */
export function hintOnHardLimit(ctx: IExecuteFunctions, result: PaginateResult<unknown>): void {
	if (!result.hitHardLimit) return;
	ctx.addExecutionHints({
		message: 'Stopped after 10,000 items. Narrow the request with filters to get the rest.',
		location: 'outputPane',
	});
}

/** Applies the "Simplify" parameter (default on) to a link. */
export function linkOutput(ctx: IExecuteFunctions, itemIndex: number, link: Link): IDataObject {
	return (ctx.getNodeParameter('simplify', itemIndex, true) as boolean) ? simplifyLink(link) : link;
}

/**
 * Error options for requests on one link. Linkwarden answers a missing link with
 * 401 "Collection is not accessible." rather than 404, so explain that.
 */
export function linkErrors(linkId: number): LinkwardenRequestOptions {
	return {
		messages: { 404: `Link ${linkId} not found` },
		hints: { 401: `Link ${linkId} may not exist, or you may not have access to it.` },
	};
}

/** `GET /api/v1/collections/{id}`. Linkwarden returns 200 with `null` for an unknown id. */
export async function fetchCollection(
	ctx: IExecuteFunctions,
	id: number,
	itemIndex: number,
): Promise<Collection> {
	const collection = await linkwardenRequest<Collection | null>(
		ctx,
		'GET',
		`/api/v1/collections/${id}`,
		requestOptions(ctx, itemIndex, { messages: { 404: `Collection ${id} not found` } }),
	);
	if (!collection) {
		throw new NodeOperationError(ctx.getNode(), `Collection ${id} not found`, { itemIndex });
	}
	return collection;
}
