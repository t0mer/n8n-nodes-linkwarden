import { describe, expect, it } from 'vitest';

import { linkOperations } from '../nodes/Linkwarden/actions/link';
import { calls, mockContext } from './helpers';

describe('Link Bulk Update', () => {
	it('sends ids, newData and removePreviousTags in one request', async () => {
		const ctx = mockContext([{ body: { response: 'All links updated successfully' } }], {
			linkIds: '1, 2',
			targetCollection: { __rl: true, mode: 'list', value: 5 },
			tags: 'a,b',
			removePreviousTags: true,
		});
		const [out] = await linkOperations.bulkUpdate.call(ctx, 0, {});
		expect(calls(ctx)[0]).toMatchObject({
			method: 'PUT',
			url: 'https://links.example.com/api/v1/links',
			body: {
				links: [{ id: 1 }, { id: 2 }],
				removePreviousTags: true,
				newData: { collectionId: 5, tags: [{ name: 'a' }, { name: 'b' }] },
			},
		});
		expect(out.json).toEqual({
			updated: 2,
			linkIds: [1, 2],
			message: 'All links updated successfully',
		});
	});

	it('caps at 500 ids', async () => {
		const ids = Array.from({ length: 501 }, (_, i) => i + 1);
		const ctx = mockContext([], { linkIds: ids, tags: 'x' });
		await expect(linkOperations.bulkUpdate.call(ctx, 0, {})).rejects.toThrow('at most 500');
	});

	it('requires a change', async () => {
		const ctx = mockContext([], { linkIds: '1' });
		await expect(linkOperations.bulkUpdate.call(ctx, 0, {})).rejects.toThrow(
			'Set Move to Collection, Tags, or Remove Previous Tags',
		);
	});
});

describe('Link Re-Archive / Delete Archives', () => {
	it('queues re-preservation', async () => {
		const ctx = mockContext([{ body: { response: 'Link is being archived.' } }], { linkId: '3' });
		const [out] = await linkOperations.reArchive.call(ctx, 0, {});
		expect(calls(ctx)[0]).toMatchObject({
			method: 'PUT',
			url: expect.stringMatching(/\/links\/3\/archive$/),
		});
		expect(out.json).toEqual({ linkId: 3, queued: true, message: 'Link is being archived.' });
	});

	it('deletes archives in one request', async () => {
		const ctx = mockContext([{ body: { response: 'Success.' } }], { linkIds: [3, 4] });
		const [out] = await linkOperations.deleteArchives.call(ctx, 0, {});
		expect(calls(ctx)[0]).toMatchObject({ method: 'DELETE', body: { linkIds: [3, 4] } });
		expect(out.json).toEqual({ linkIds: [3, 4], message: 'Success.' });
	});
});
