import { describe, expect, it } from 'vitest';

import { paginate } from '../shared/paginate';
import { calls, mockContext } from './helpers';

const links = (from: number, count: number) =>
	Array.from({ length: count }, (_, i) => ({ id: from - i }));

const searchPage = (items: object[], nextCursor: unknown) => ({
	body: { message: '', data: { links: items, nextCursor } },
});

describe('paginate nextCursor (link listing through search)', () => {
	it('passes the id cursor and stops on null', async () => {
		const ctx = mockContext([searchPage(links(100, 3), 98), searchPage(links(97, 2), null)]);
		const res = await paginate(
			ctx,
			'nextCursor',
			'/api/v1/search',
			{ sort: 0 },
			{ returnAll: true },
		);
		expect(res.items.map((l) => l.id)).toEqual([100, 99, 98, 97, 96]);
		expect(res.hitHardLimit).toBe(false);
		const qs = calls(ctx).map((c) => c.qs);
		expect(qs).toEqual([{ sort: 0 }, { sort: 0, cursor: 98 }]);
	});

	it('keeps going past an empty page that still has a cursor (Meilisearch + filters)', async () => {
		const ctx = mockContext([searchPage([], 50), searchPage([{ id: 7 }], null)]);
		const res = await paginate(ctx, 'nextCursor', '/api/v1/search', {}, { returnAll: true });
		expect(res.items).toEqual([{ id: 7 }]);
	});

	it('stops as soon as the limit is reached', async () => {
		const ctx = mockContext([searchPage(links(100, 50), 51), searchPage([], null)]);
		const res = await paginate(ctx, 'nextCursor', '/api/v1/search', {}, { limit: 10 });
		expect(res.items).toHaveLength(10);
		expect(calls(ctx)).toHaveLength(1);
	});

	it('hard-stops at 10,000 items with returnAll', async () => {
		let next = 20_000;
		const ctx = mockContext(() => {
			const page = links(next, 50);
			next -= 50;
			return searchPage(page, next);
		});
		const res = await paginate(ctx, 'nextCursor', '/api/v1/search', {}, { returnAll: true });
		expect(res.items).toHaveLength(10_000);
		expect(res.hitHardLimit).toBe(true);
	});
});

describe('paginate nextCursor', () => {
	it('passes the opaque cursor through and stops on null', async () => {
		const ctx = mockContext([
			{ body: { message: '', data: { links: links(10, 2), nextCursor: 'abc' } } },
			{ body: { message: '', data: { links: links(8, 2), nextCursor: null } } },
		]);
		const res = await paginate(
			ctx,
			'nextCursor',
			'/api/v1/search',
			{ searchQueryString: 'x' },
			{
				returnAll: true,
			},
		);
		expect(res.items).toHaveLength(4);
		expect(calls(ctx)[1].qs).toEqual({ searchQueryString: 'x', cursor: 'abc' });
	});

	it('reads tags with itemsKey and stops on undefined nextCursor', async () => {
		const ctx = mockContext([{ body: { success: true, data: { tags: [{ id: 1 }, { id: 2 }] } } }]);
		const res = await paginate(
			ctx,
			'nextCursor',
			'/api/v1/tags',
			{},
			{ itemsKey: 'tags', limit: 50 },
		);
		expect(res.items).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it('treats the Meilisearch empty `data: []` as an empty page', async () => {
		const ctx = mockContext([{ body: { message: 'Nothing found.', data: [] } }]);
		const res = await paginate(ctx, 'nextCursor', '/api/v1/search', {}, { returnAll: true });
		expect(res.items).toEqual([]);
	});

	it('respects maxPages', async () => {
		const ctx = mockContext(() => ({
			body: { data: { links: links(5, 1), nextCursor: Math.random() } },
		}));
		const res = await paginate(
			ctx,
			'nextCursor',
			'/api/v1/search',
			{},
			{ returnAll: true, maxPages: 5 },
		);
		expect(res.items).toHaveLength(5);
		expect(calls(ctx)).toHaveLength(5);
	});
});

describe('paginate none', () => {
	it('slices client-side', async () => {
		const ctx = mockContext([{ body: { response: links(10, 10) } }]);
		const res = await paginate(ctx, 'none', '/api/v1/collections', {}, { limit: 3 });
		expect(res.items.map((c) => c.id)).toEqual([10, 9, 8]);
	});
});
