import { describe, expect, it } from 'vitest';

import { rssOperations } from '../nodes/Linkwarden/actions/rss';
import { calls, mockContext } from './helpers';

describe('RSS Subscription', () => {
	it('sends collectionId for list/id mode', async () => {
		const ctx = mockContext([{ body: { response: { id: 1 } } }], {
			name: 'HN',
			url: 'https://news.ycombinator.com/rss',
			collection: { __rl: true, mode: 'list', value: 4 },
		});
		await rssOperations.create.call(ctx, 0, {});
		expect(calls(ctx)[0].body).toEqual({
			name: 'HN',
			url: 'https://news.ycombinator.com/rss',
			collectionId: 4,
		});
	});

	it('reuses an existing collection by name, ignoring case', async () => {
		const ctx = mockContext(
			[
				{ body: { response: [{ id: 2, name: 'Work', ownerId: 1, parentId: null }] } },
				{ body: { response: { id: 1 } } },
			],
			{
				name: 'HN',
				url: 'https://news.ycombinator.com/rss',
				collection: { __rl: true, mode: 'name', value: 'work' },
			},
		);
		await rssOperations.create.call(ctx, 0, {});
		expect(calls(ctx)[1].body).toEqual({
			name: 'HN',
			url: 'https://news.ycombinator.com/rss',
			collectionId: 2,
		});
	});

	it('sends collectionName when no collection has that name', async () => {
		const ctx = mockContext([{ body: { response: [] } }, { body: { response: { id: 1 } } }], {
			name: 'HN',
			url: 'https://news.ycombinator.com/rss',
			collection: { __rl: true, mode: 'name', value: 'Feeds' },
		});
		await rssOperations.create.call(ctx, 0, {});
		expect(calls(ctx)[1].body).toMatchObject({ collectionName: 'Feeds' });
	});

	it('rejects names over 50 characters', async () => {
		const ctx = mockContext([], { name: 'x'.repeat(51), url: 'u', collection: 1 });
		await expect(rssOperations.create.call(ctx, 0, {})).rejects.toThrow('1–50 characters');
	});

	it('limits get many client-side', async () => {
		const ctx = mockContext([{ body: { response: [{ id: 1 }, { id: 2 }, { id: 3 }] } }], {
			returnAll: false,
			limit: 2,
		});
		expect(await rssOperations.getAll.call(ctx, 0, {})).toHaveLength(2);
	});
});
