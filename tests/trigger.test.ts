import { describe, expect, it, vi } from 'vitest';

import { LinkwardenTrigger } from '../nodes/LinkwardenTrigger/LinkwardenTrigger.node';
import { calls, mockContext, type Responder } from './helpers';

type LinkRow = { id: number; collectionId: number; name?: string };

/** Serves GET /links newest-first with id cursors, page size 2, honoring collectionId/tagId. */
function server(links: LinkRow[], opts: { fail?: boolean; tagged?: number[] } = {}): Responder {
	return ({ url, qs = {} }) => {
		if (opts.fail) return { statusCode: 500, body: { response: 'boom' } };
		if (url.endsWith('/api/v1/collections')) {
			return {
				body: {
					response: [
						{ id: 1, name: 'Root', ownerId: 1, parentId: null },
						{ id: 2, name: 'Child', ownerId: 1, parentId: 1 },
						{ id: 3, name: 'Other', ownerId: 1, parentId: null },
					],
				},
			};
		}
		let rows = [...links].sort((a, b) => b.id - a.id);
		if (qs.collectionId) rows = rows.filter((l) => l.collectionId === qs.collectionId);
		if (qs.tagId) rows = rows.filter((l) => opts.tagged?.includes(l.id));
		if (qs.cursor) rows = rows.filter((l) => l.id < (qs.cursor as number));
		return { body: { response: rows.slice(0, 2) } };
	};
}

function triggerCtx(
	responder: Responder,
	params: Record<string, unknown> = {},
	staticData: Record<string, unknown> = {},
	mode = 'trigger',
) {
	const ctx = mockContext(
		responder,
		{},
		{
			getMode: () => mode,
			getWorkflowStaticData: vi.fn(() => staticData),
		},
	);
	ctx.getNodeParameter = vi.fn((name: string, fallback?: unknown) =>
		name in params ? params[name] : fallback,
	);
	ctx.helpers.returnJsonArray = (items: object[]) => items.map((json) => ({ json }));
	return ctx;
}

const poll = (ctx: ReturnType<typeof triggerCtx>) => new LinkwardenTrigger().poll!.call(ctx);
const ids = (out: Awaited<ReturnType<typeof poll>>) => out![0].map((i) => i.json.id);

describe('Linkwarden Trigger', () => {
	it('seeds silently on first run with the newest id', async () => {
		const state: Record<string, unknown> = {};
		const ctx = triggerCtx(
			server([
				{ id: 5, collectionId: 1 },
				{ id: 9, collectionId: 1 },
			]),
			{},
			state,
		);
		expect(await poll(ctx)).toBeNull();
		expect(state).toMatchObject({ version: 1, lastSeenId: 9 });
		expect(typeof state.lastPollAt).toBe('string');
		expect(calls(ctx)).toHaveLength(1);
	});

	it('emits new links oldest to newest, stopping at the last seen id', async () => {
		const links = [5, 9, 10, 11, 12].map((id) => ({ id, collectionId: 1 }));
		const state: Record<string, unknown> = {};
		await poll(triggerCtx(server(links.slice(0, 2)), {}, state));
		const ctx = triggerCtx(server(links), {}, state);
		expect(ids(await poll(ctx))).toEqual([10, 11, 12]);
		expect(state.lastSeenId).toBe(12);
		expect(await poll(triggerCtx(server(links), {}, state))).toBeNull();
	});

	it('reseeds when the filters change', async () => {
		const links = [1, 2, 3].map((id) => ({ id, collectionId: 1 }));
		const state: Record<string, unknown> = {};
		await poll(triggerCtx(server(links), {}, state));
		const ctx = triggerCtx(
			server([...links, { id: 4, collectionId: 1 }]),
			{ collection: { __rl: true, mode: 'id', value: '1' } },
			state,
		);
		expect(await poll(ctx)).toBeNull();
		expect(state.lastSeenId).toBe(4);
		expect(calls(ctx)[0].qs).toMatchObject({ sort: 0, collectionId: 1 });
	});

	it('emits the newest maxPerPoll links and flags truncation', async () => {
		const state = {
			version: 1,
			filterKey: '{"collectionId":null,"tagId":null,"includeSubcollections":false}',
			lastSeenId: 1,
		};
		const links = [1, 2, 3, 4, 5, 6].map((id) => ({ id, collectionId: 1 }));
		const out = await poll(triggerCtx(server(links), { options: { maxPerPoll: 3 } }, state));
		expect(ids(out)).toEqual([4, 5, 6]);
		expect(out![0][2].json.truncated).toBe(true);
		expect(out![0][0].json).not.toHaveProperty('truncated');
		expect(state.lastSeenId).toBe(6);
	});

	it('manual mode returns up to 5 samples and touches no state', async () => {
		const state: Record<string, unknown> = {};
		const links = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, collectionId: 1 }));
		const ctx = triggerCtx(server(links), {}, state, 'manual');
		expect(ids(await poll(ctx))).toEqual([3, 4, 5, 6, 7]);
		expect(state).toEqual({});
		expect(ctx.getWorkflowStaticData).not.toHaveBeenCalled();
	});

	it('leaves state unchanged when a request fails', async () => {
		const state = { version: 1, filterKey: 'x', lastSeenId: 3, lastPollAt: 'then' };
		const before = { ...state };
		const ctx = triggerCtx(server([], { fail: true }), { requestOptions: {} }, state);
		await expect(poll(ctx)).rejects.toThrow();
		expect(state).toEqual(before);
	});

	it('includes subcollections client-side', async () => {
		const links = [
			{ id: 1, collectionId: 1 },
			{ id: 2, collectionId: 2 },
			{ id: 3, collectionId: 3 },
			{ id: 4, collectionId: 2 },
		];
		const params = {
			collection: { __rl: true, mode: 'id', value: 1 },
			options: { includeSubcollections: true },
		};
		const state: Record<string, unknown> = {};
		await poll(triggerCtx(server(links.slice(0, 1)), params, state));
		const ctx = triggerCtx(server(links), params, state);
		expect(ids(await poll(ctx))).toEqual([2, 4]);
		expect(state.lastSeenId).toBe(4);
		const linkCalls = calls(ctx).filter((c) => c.url.endsWith('/api/v1/links'));
		expect(linkCalls[0].qs).not.toHaveProperty('collectionId');
	});

	it('filters by tag and simplifies by default', async () => {
		const state = {
			version: 1,
			filterKey: '{"collectionId":null,"tagId":7,"includeSubcollections":false}',
			lastSeenId: 0,
		};
		const links = [
			{ id: 1, collectionId: 1, name: 'A' },
			{ id: 2, collectionId: 1, name: 'B' },
		];
		const ctx = triggerCtx(
			server(links, { tagged: [2] }),
			{ tag: { __rl: true, mode: 'list', value: 7 } },
			state,
		);
		const out = await poll(ctx);
		expect(ids(out)).toEqual([2]);
		expect(out![0][0].json).toMatchObject({ id: 2, name: 'B', archives: expect.any(Object) });
		expect(calls(ctx)[0].qs).toMatchObject({ tagId: 7 });
	});
});
