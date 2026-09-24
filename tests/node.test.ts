import { describe, expect, it, vi } from 'vitest';

import { Linkwarden } from '../nodes/Linkwarden/Linkwarden.node';
import { calls, mockContext, type Responder } from './helpers';
import link from './fixtures/link.json';

/** Runs the node's execute() over `items`, with per-item parameters. */
async function execute(
	responder: Responder,
	items: Array<Record<string, unknown>>,
	params: (i: number) => Record<string, unknown>,
	continueOnFail = false,
) {
	const ctx = mockContext(
		responder,
		{},
		{
			getInputData: () => items.map((json) => ({ json })),
			continueOnFail: () => continueOnFail,
			addExecutionHints: vi.fn(),
		},
	);
	ctx.getNodeParameter = vi.fn((name: string, i: number, fallback?: unknown) => {
		const p = params(i);
		return name in p ? p[name] : fallback;
	});
	const [out] = await new Linkwarden().execute.call(ctx);
	return { out, ctx };
}

describe('Linkwarden node execute', () => {
	it('pairs every output with its input item', async () => {
		const { out } = await execute(
			() => ({ body: { response: link } }),
			[{ id: 1 }, { id: 2 }],
			(i) => ({ resource: 'link', operation: 'get', linkId: String(i + 1) }),
		);
		expect(out.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
	});

	it('runs Delete Many once from the first item by default', async () => {
		const { out, ctx } = await execute(
			() => ({ body: { response: { count: 2 } } }),
			[{}, {}, {}],
			() => ({ resource: 'link', operation: 'deleteMany', linkIds: '1,2' }),
		);
		expect(calls(ctx)).toHaveLength(1);
		expect(calls(ctx)[0].body).toEqual({ linkIds: [1, 2] });
		expect(out).toEqual([{ json: { deleted: 2, linkIds: [1, 2] }, pairedItem: { item: 0 } }]);
	});

	it('runs Delete Many per item when runOnce is off', async () => {
		const { ctx } = await execute(
			() => ({ body: { response: { count: 1 } } }),
			[{}, {}],
			(i) => ({
				resource: 'link',
				operation: 'deleteMany',
				linkIds: String(i + 1),
				runOnce: false,
			}),
		);
		expect(calls(ctx)).toHaveLength(2);
	});

	it('fetches the current user once for Pin across items', async () => {
		const seen: string[] = [];
		const { out } = await execute(
			({ method, url, body }) => {
				seen.push(`${method} ${url.split('/api/v1')[1]}`);
				if (url.endsWith('/users/me')) return { body: { response: { id: 9 } } };
				if (method === 'GET') return { body: { response: link } };
				return { body: { response: body } };
			},
			[{}, {}],
			() => ({ resource: 'link', operation: 'pin', linkId: '42', simplify: false }),
		);
		expect(seen.filter((s) => s.endsWith('/users/me'))).toHaveLength(1);
		expect(out[0].json.pinnedBy).toEqual([{ id: 9 }]);
	});

	it('continueOnFail emits the error with status code and input', async () => {
		const { out } = await execute(
			() => ({ statusCode: 404, body: { response: 'Link not found.' } }),
			[{ foo: 'bar' }],
			() => ({ resource: 'link', operation: 'get', linkId: '5' }),
			true,
		);
		expect(out).toEqual([
			{
				json: { error: 'Link 5 not found', statusCode: 404, input: { foo: 'bar' } },
				pairedItem: { item: 0 },
			},
		]);
	});

	it('throws when continueOnFail is off', async () => {
		await expect(
			execute(
				() => ({ statusCode: 404, body: { response: 'Link not found.' } }),
				[{}],
				() => ({ resource: 'link', operation: 'get', linkId: '5' }),
			),
		).rejects.toMatchObject({ message: 'Link 5 not found', httpCode: '404' });
	});
});
