import { describe, expect, it } from 'vitest';

import { linkOperations } from '../nodes/Linkwarden/actions/link';
import { calls, mockContext, type Responder } from './helpers';

const URL = 'https://example.com/post';
const existing = { id: 7, url: 'https://www.example.com/post/', name: 'Post' };
const created = { id: 8, url: URL, name: 'New' };

/** Routes: POST /links → `postStatus`, GET /search → `existing`, GET /collections → list. */
const routes =
	(postStatus: number): Responder =>
	({ method, url }) => {
		if (method === 'POST' && url.endsWith('/api/v1/links')) {
			return postStatus === 409
				? { statusCode: 409, body: { response: 'Link already exists' } }
				: { body: { response: created } };
		}
		if (url.includes('/api/v1/search')) {
			return { body: { data: { links: [existing], nextCursor: null } } };
		}
		if (url.endsWith('/api/v1/collections')) {
			return { body: { response: [{ id: 3, name: 'Read Later', ownerId: 1, parentId: null }] } };
		}
		throw new Error(`unexpected ${method} ${url}`);
	};

const run = (ctx: ReturnType<typeof mockContext>) => linkOperations.create.call(ctx, 0, {});

describe('Link Create', () => {
	it('creates a link with tags and collection by id', async () => {
		const ctx = mockContext(routes(200), {
			url: ` ${URL} `,
			additionalFields: {
				name: 'New',
				tags: 'news, to-read,',
				collection: { __rl: true, mode: 'id', value: '3' },
			},
		});
		const [out] = await run(ctx);
		expect(out.json).toEqual({ ...created, duplicate: false });
		expect(calls(ctx)[0].body).toEqual({
			url: URL,
			type: 'url',
			name: 'New',
			tags: [{ name: 'news' }, { name: 'to-read' }],
			collection: { id: 3 },
		});
	});

	it('resolves a collection by name', async () => {
		const ctx = mockContext(routes(200), {
			url: URL,
			additionalFields: { collection: { __rl: true, mode: 'name', value: 'read later' } },
		});
		await run(ctx);
		const post = calls(ctx).find((c) => c.method === 'POST');
		expect(post?.body.collection).toEqual({ id: 3 });
	});

	it('409 + returnExisting (default) returns the saved link with duplicate: true', async () => {
		const ctx = mockContext(routes(409), { url: URL });
		const [out] = await run(ctx);
		expect(out.json).toEqual({ ...existing, duplicate: true });
	});

	it('409 + skip emits nothing', async () => {
		const ctx = mockContext(routes(409), { url: URL, options: { onDuplicate: 'skip' } });
		expect(await run(ctx)).toEqual([]);
		expect(calls(ctx).some((c) => c.url.includes('/search'))).toBe(false);
	});

	it('409 + error throws', async () => {
		const ctx = mockContext(routes(409), { url: URL, options: { onDuplicate: 'error' } });
		await expect(run(ctx)).rejects.toThrow(`Link already exists: ${URL}`);
	});

	it('precheckDuplicate finds the link before POSTing', async () => {
		const ctx = mockContext(routes(200), { url: URL, options: { precheckDuplicate: true } });
		const [out] = await run(ctx);
		expect(out.json).toMatchObject({ id: 7, duplicate: true });
		expect(calls(ctx).some((c) => c.method === 'POST')).toBe(false);
	});

	it('precheckDuplicate with no match creates the link', async () => {
		const ctx = mockContext(
			(opts) =>
				opts.url.includes('/search')
					? { body: { message: 'Nothing found.', data: [] } }
					: routes(200)(opts),
			{ url: URL, options: { precheckDuplicate: true, onDuplicate: 'skip' } },
		);
		const [out] = await run(ctx);
		expect(out.json).toMatchObject({ id: 8, duplicate: false });
	});
});
