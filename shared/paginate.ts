import type { IDataObject } from 'n8n-workflow';

import { MAX_ITEMS } from './constants';
import { linkwardenRequest, type LinkwardenContext } from './transport';

/**
 * - `linksCursor`: `GET /api/v1/links`. No cursor in the response: the next cursor is the
 *   id of the last item, stop on an empty page.
 * - `nextCursor`: `GET /api/v1/search` and `GET /api/v1/tags`. Opaque `data.nextCursor`,
 *   stop when it's null/undefined.
 * - `none`: the endpoint returns everything at once; limit client-side.
 */
export type PaginationKind = 'linksCursor' | 'nextCursor' | 'none';

export interface PaginateOptions {
	returnAll?: boolean;
	limit?: number;
	/** Key of the item array inside `data` for `nextCursor` endpoints (`links` or `tags`). */
	itemsKey?: string;
	itemIndex?: number;
	maxRetries?: number;
	/** Upper bound for the number of pages to fetch. */
	maxPages?: number;
}

export interface PaginateResult<T> {
	items: T[];
	/** True when the 10,000-item hard stop cut the results short. */
	hitHardLimit: boolean;
}

interface Page<T> {
	items: T[];
	nextCursor: unknown;
}

function toPage<T>(data: unknown, kind: PaginationKind, itemsKey: string): Page<T> {
	if (Array.isArray(data)) {
		const items = data as T[];
		const last = items[items.length - 1] as IDataObject | undefined;
		return { items, nextCursor: kind === 'linksCursor' ? last?.id : null };
	}
	if (data !== null && typeof data === 'object') {
		const obj = data as IDataObject;
		const items = (Array.isArray(obj[itemsKey]) ? obj[itemsKey] : []) as T[];
		return { items, nextCursor: obj.nextCursor };
	}
	return { items: [], nextCursor: null };
}

export async function paginate<T = IDataObject>(
	ctx: LinkwardenContext,
	kind: PaginationKind,
	path: string,
	qs: IDataObject = {},
	options: PaginateOptions = {},
): Promise<PaginateResult<T>> {
	const cap = options.returnAll ? MAX_ITEMS : Math.min(Math.max(options.limit ?? 50, 1), MAX_ITEMS);
	const itemsKey = options.itemsKey ?? 'links';
	const requestOptions = { itemIndex: options.itemIndex, maxRetries: options.maxRetries };

	if (kind === 'none') {
		const data = await linkwardenRequest<unknown>(ctx, 'GET', path, { qs, ...requestOptions });
		const all = toPage<T>(data, kind, itemsKey).items;
		return {
			items: all.slice(0, cap),
			hitHardLimit: !!options.returnAll && all.length > MAX_ITEMS,
		};
	}

	const items: T[] = [];
	let cursor: unknown;
	let pages = 0;
	let exhausted = false;

	while (items.length < cap) {
		if (options.maxPages !== undefined && pages >= options.maxPages) break;
		const pageQs: IDataObject = { ...qs };
		if (cursor !== undefined && cursor !== null) pageQs.cursor = cursor as string | number;

		const data = await linkwardenRequest<unknown>(ctx, 'GET', path, {
			qs: pageQs,
			...requestOptions,
		});
		pages++;
		const page = toPage<T>(data, kind, itemsKey);
		items.push(...page.items);

		const noProgress = page.nextCursor === cursor;
		if (
			page.items.length === 0 ||
			page.nextCursor === null ||
			page.nextCursor === undefined ||
			noProgress
		) {
			exhausted = true;
			break;
		}
		cursor = page.nextCursor;
	}

	return {
		items: items.slice(0, cap),
		hitHardLimit: !!options.returnAll && !exhausted && items.length >= MAX_ITEMS,
	};
}
