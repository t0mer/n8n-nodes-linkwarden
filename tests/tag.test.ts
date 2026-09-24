import { describe, expect, it } from 'vitest';

import { tagOperations } from '../nodes/Linkwarden/actions/tag';
import { calls, mockContext } from './helpers';

const rl = (value: string | number) => ({ __rl: true, mode: 'list', value });

describe('Tag', () => {
	it('create sends label (not name) with overrides applied to every tag', async () => {
		const ctx = mockContext(
			[
				{
					body: {
						response: [
							{ id: 1, name: 'a' },
							{ id: 2, name: 'b' },
						],
					},
				},
			],
			{
				names: 'a, b',
				preservation: { archiveAsPDF: false, aiTag: true },
			},
		);
		const out = await tagOperations.create.call(ctx, 0, {});
		expect(calls(ctx)[0].body).toEqual({
			tags: [
				{ label: 'a', archiveAsPDF: false, aiTag: true },
				{ label: 'b', archiveAsPDF: false, aiTag: true },
			],
		});
		expect(out.map((o) => o.json.id)).toEqual([1, 2]);
	});

	it('get many passes search and sort and pages with nextCursor', async () => {
		const ctx = mockContext(
			[
				{ body: { data: { tags: [{ id: 3 }], nextCursor: 3 } } },
				{ body: { data: { tags: [{ id: 2 }], nextCursor: null } } },
			],
			{ returnAll: true, search: ' ne ', sort: 4 },
		);
		const out = await tagOperations.getAll.call(ctx, 0, {});
		expect(out.map((o) => o.json.id)).toEqual([3, 2]);
		expect(calls(ctx)[1].qs).toEqual({ sort: 4, search: 'ne', cursor: 3 });
	});

	it('rename sends { name }', async () => {
		const ctx = mockContext([{ body: { response: { id: 3, name: 'new' } } }], {
			tag: rl(3),
			newName: ' new ',
		});
		await tagOperations.rename.call(ctx, 0, {});
		expect(calls(ctx)[0]).toMatchObject({ method: 'PUT', body: { name: 'new' } });
	});

	it('delete many sends tagIds and reports the count', async () => {
		const ctx = mockContext([{ body: { response: 2 } }], { tagIds: '4,5' });
		const [out] = await tagOperations.deleteMany.call(ctx, 0, {});
		expect(calls(ctx)[0].body).toEqual({ tagIds: [4, 5] });
		expect(out.json).toEqual({ deleted: 2, tagIds: [4, 5] });
	});

	it('get maps 404 to a clear message', async () => {
		const ctx = mockContext([{ statusCode: 404, body: { response: 'Not found.' } }], {
			tag: rl('9'),
		});
		await expect(tagOperations.get.call(ctx, 0, {})).rejects.toThrow('Tag 9 not found');
	});
});
