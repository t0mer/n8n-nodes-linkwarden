import { describe, expect, it } from 'vitest';

import { linkOperations } from '../nodes/Linkwarden/actions/link';
import { simplifyLink } from '../shared/simplify';
import type { Link } from '../shared/types';
import link from './fixtures/link.json';
import { mockContext } from './helpers';

describe('simplifyLink', () => {
	it('returns the compact shape', () => {
		expect(simplifyLink(link as unknown as Link)).toEqual({
			id: 42,
			name: 'Example Article',
			url: 'https://links.example.com/article',
			description: 'Saved for later',
			type: 'url',
			collectionId: 3,
			collectionName: 'Read Later',
			tags: ['News', 'dev'],
			pinned: false,
			createdAt: '2026-09-01T09:59:00.000Z',
			updatedAt: '2026-09-01T10:00:00.000Z',
			preservedAt: '2026-09-01T10:00:00.000Z',
			archives: { screenshot: true, pdf: true, readable: true, monolith: false },
		});
	});

	it('treats "unavailable" and missing archives as false and detects pins', () => {
		const out = simplifyLink({
			id: 1,
			image: 'unavailable',
			pdf: '',
			pinnedBy: [{ id: 3 }],
			collectionId: 9,
		} as Link);
		expect(out.archives).toEqual({
			screenshot: false,
			pdf: false,
			readable: false,
			monolith: false,
		});
		expect(out.pinned).toBe(true);
		expect(out.collectionId).toBe(9);
		expect(out.tags).toEqual([]);
	});
});

describe('simplify parameter', () => {
	it('is on by default and returns the raw link when off', async () => {
		const on = mockContext([{ body: { response: link } }], { linkId: 42 });
		const [simple] = await linkOperations.get.call(on, 0, {});
		expect(simple.json.tags).toEqual(['News', 'dev']);

		const off = mockContext([{ body: { response: link } }], { linkId: 42, simplify: false });
		const [raw] = await linkOperations.get.call(off, 0, {});
		expect(raw.json).toEqual(link);
	});

	it('applies to Find by URL matches', async () => {
		const ctx = mockContext([{ body: { data: { links: [link], nextCursor: null } } }], {
			url: 'https://links.example.com/article/',
		});
		const [out] = await linkOperations.findByUrl.call(ctx, 0, {});
		expect(out.json.link).toMatchObject({ id: 42, collectionName: 'Read Later' });
		expect(out.json.link).not.toHaveProperty('collection');
	});
});
