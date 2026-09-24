import { describe, expect, it } from 'vitest';

import { linkOperations } from '../nodes/Linkwarden/actions/link';
import { calls, mockContext } from './helpers';

const search = (links: object[], nextCursor: unknown = null) => ({
	body: { message: '', data: { links, nextCursor } },
});

async function run(ctx: ReturnType<typeof mockContext>) {
	const [out] = await linkOperations.findByUrl.call(ctx, 0, {});
	return out.json;
}

describe('Find by URL', () => {
	it('keeps only exact normalized matches among fuzzy results', async () => {
		const ctx = mockContext(
			[
				search([
					{ id: 3, url: 'https://example.com/post/2' },
					{ id: 2, url: 'https://www.example.com/post/' },
					{ id: 1, url: 'https://other.org/?ref=example.com/post' },
				]),
			],
			{ url: 'https://example.com/post#top' },
		);
		const json = await run(ctx);
		expect(json.found).toBe(true);
		expect((json.matches as Array<{ id: number }>).map((l) => l.id)).toEqual([2]);
		expect(json.link).toMatchObject({ id: 2 });
		expect(calls(ctx)[0].url).toBe('https://links.example.com/api/v1/search');
		expect(calls(ctx)[0].qs).toEqual({ searchQueryString: 'example.com/post', sort: 0 });
	});

	it('returns found: false without throwing when nothing matches', async () => {
		const ctx = mockContext([{ body: { message: 'Nothing found.', data: [] } }], {
			url: 'https://example.com/none',
		});
		expect(await run(ctx)).toEqual({ found: false, matches: [], link: null });
	});

	it('returns multiple matches and scopes by collection', async () => {
		const ctx = mockContext(
			[
				search([{ id: 5, url: 'https://example.com/a' }], 'c1'),
				search([{ id: 4, url: 'https://example.com/a/' }]),
			],
			{ url: 'https://example.com/a', scope: { __rl: true, mode: 'id', value: '9' } },
		);
		const json = await run(ctx);
		expect((json.matches as Array<{ id: number }>).map((l) => l.id)).toEqual([5, 4]);
		expect(calls(ctx)[0].qs.collectionId).toBe(9);
		expect(calls(ctx)[1].qs.cursor).toBe('c1');
	});

	it('stops after 5 pages', async () => {
		let n = 100;
		const ctx = mockContext(() => search([{ id: n--, url: 'https://x.org' }], `c${n}`), {
			url: 'https://example.com/a',
		});
		await run(ctx);
		expect(calls(ctx)).toHaveLength(5);
	});
});
