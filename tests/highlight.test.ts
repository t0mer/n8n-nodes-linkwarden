import { describe, expect, it } from 'vitest';

import { highlightOperations } from '../nodes/Linkwarden/actions/highlight';
import { calls, mockContext } from './helpers';

describe('Highlight', () => {
	it('upserts with a preset color', async () => {
		const ctx = mockContext([{ body: { response: { id: 1 } } }], {
			linkId: '4',
			text: 'Hello',
			startOffset: 0,
			endOffset: 5,
			color: 'green',
			comment: 'note',
		});
		await highlightOperations.upsert.call(ctx, 0, {});
		expect(calls(ctx)[0]).toMatchObject({
			method: 'POST',
			url: 'https://links.example.com/api/v1/highlights',
			body: {
				linkId: 4,
				color: 'green',
				startOffset: 0,
				endOffset: 5,
				text: 'Hello',
				comment: 'note',
			},
		});
	});

	it('supports a custom color and omits an empty comment', async () => {
		const ctx = mockContext([{ body: { response: { id: 1 } } }], {
			linkId: 4,
			text: 'x',
			startOffset: 1,
			endOffset: 2,
			color: 'custom',
			customValue: ' purple ',
		});
		await highlightOperations.upsert.call(ctx, 0, {});
		expect(calls(ctx)[0].body).toEqual({
			linkId: 4,
			color: 'purple',
			startOffset: 1,
			endOffset: 2,
			text: 'x',
		});
	});

	it('rejects reversed offsets', async () => {
		const ctx = mockContext([], { linkId: 4, text: 'x', startOffset: 5, endOffset: 2 });
		await expect(highlightOperations.upsert.call(ctx, 0, {})).rejects.toThrow('End Offset');
	});

	it('lists highlights of a link', async () => {
		const ctx = mockContext([{ body: { response: [{ id: 1 }, { id: 2 }] } }], { linkId: '4' });
		const out = await highlightOperations.getAll.call(ctx, 0, {});
		expect(out).toHaveLength(2);
		expect(calls(ctx)[0].url).toMatch(/\/api\/v1\/links\/4\/highlights$/);
	});
});
