import { describe, expect, it } from 'vitest';

import { collectionOperations } from '../nodes/Linkwarden/actions/collection';
import collections from './fixtures/collections.json';
import { calls, mockContext, type Responder } from './helpers';

const byId = (id: number) => collections.find((c) => c.id === id);

const routes: Responder = ({ method, url, body }) => {
	const path = url.replace('https://links.example.com', '');
	if (method === 'GET' && path === '/api/v1/collections')
		return { body: { response: collections } };
	const match = /^\/api\/v1\/collections\/(\d+)$/.exec(path);
	if (method === 'GET' && match) return { body: { response: byId(Number(match[1])) } };
	if (method === 'PUT' || method === 'POST' || method === 'DELETE') {
		return { body: { response: { id: 99, ...(body as object) } } };
	}
	throw new Error(`unexpected ${method} ${path}`);
};

const rl = (mode: string, value: string | number) => ({ __rl: true, mode, value });

describe('Collection', () => {
	it('creates via POST /api/v1/collections (not the spec path)', async () => {
		const ctx = mockContext(routes, {
			name: ' Reading ',
			additionalFields: { color: '#00ff00', parent: rl('name', 'work') },
		});
		await collectionOperations.create.call(ctx, 0, {});
		const post = calls(ctx).find((c) => c.method === 'POST')!;
		expect(post.url).toBe('https://links.example.com/api/v1/collections');
		expect(post.body).toEqual({ name: 'Reading', color: '#00ff00', parentId: 2 });
	});

	it('update echoes current members unchanged and keeps untouched fields', async () => {
		const ctx = mockContext(routes, {
			collection: rl('id', '2'),
			updateFields: { name: 'Job' },
		});
		await collectionOperations.update.call(ctx, 0, {});
		const put = calls(ctx).find((c) => c.method === 'PUT')!;
		expect(put.url).toMatch(/\/api\/v1\/collections\/2$/);
		expect(put.body).toEqual({
			id: 2,
			name: 'Job',
			description: 'Work stuff',
			color: '#ff0000',
			icon: 'briefcase',
			iconWeight: 'bold',
			isPublic: true,
			members: [{ userId: 5, canCreate: true, canUpdate: false, canDelete: false }],
		});
	});

	it('update can move to top level or under a parent', async () => {
		const top = mockContext(routes, {
			collection: rl('id', 3),
			updateFields: { moveToTopLevel: true },
		});
		await collectionOperations.update.call(top, 0, {});
		expect(calls(top).find((c) => c.method === 'PUT')!.body.parentId).toBe('root');

		const under = mockContext(routes, {
			collection: rl('list', 3),
			updateFields: { parent: rl('id', '1') },
		});
		await collectionOperations.update.call(under, 0, {});
		expect(calls(under).find((c) => c.method === 'PUT')!.body.parentId).toBe(1);
	});

	it('update requires a field', async () => {
		const ctx = mockContext(routes, { collection: rl('id', 2), updateFields: {} });
		await expect(collectionOperations.update.call(ctx, 0, {})).rejects.toThrow(
			'Add at least one field',
		);
	});

	it('get many filters client-side and adds the path', async () => {
		const top = mockContext(routes, { returnAll: true, filters: { topLevelOnly: true } });
		expect((await collectionOperations.getAll.call(top, 0, {})).map((o) => o.json.id)).toEqual([
			1, 2,
		]);

		const children = mockContext(routes, { returnAll: true, filters: { parent: rl('id', 2) } });
		const out = await collectionOperations.getAll.call(children, 0, {});
		expect(out.map((o) => o.json.id)).toEqual([3]);

		const limited = mockContext(routes, { returnAll: false, limit: 2 });
		const all = await collectionOperations.getAll.call(limited, 0, {});
		expect(all).toHaveLength(2);
		expect(all[1].json.path).toBe('Work');
	});

	it('deletes by name', async () => {
		const ctx = mockContext(routes, { collection: rl('name', 'Research') });
		const [out] = await collectionOperations.delete.call(ctx, 0, {});
		expect(calls(ctx)[calls(ctx).length - 1]).toMatchObject({
			method: 'DELETE',
			url: expect.stringMatching(/collections\/3$/),
		});
		expect(out.json).toEqual({ id: 3, deleted: true });
	});
});

describe('Collection not found', () => {
	it('turns the 200 null response into a clear error', async () => {
		const ctx = mockContext([{ body: { response: null } }], { collection: rl('id', '999') });
		await expect(collectionOperations.get.call(ctx, 0, {})).rejects.toThrow(
			'Collection 999 not found',
		);
	});
});
