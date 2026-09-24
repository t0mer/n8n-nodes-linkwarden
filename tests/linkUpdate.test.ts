import { describe, expect, it } from 'vitest';

import { linkOperations } from '../nodes/Linkwarden/actions/link';
import { buildLinkUpdateBody, buildPinBody, mergeTags } from '../shared/linkUpdate';
import type { Link } from '../shared/types';
import link from './fixtures/link.json';
import { calls, mockContext, type Responder } from './helpers';

const current = link as unknown as Link;
const tags = current.tags!;

describe('mergeTags', () => {
	it('add keeps current tags and dedupes case-insensitively', () => {
		expect(mergeTags(tags, ['news', 'AI'], 'add')).toEqual([
			{ id: 1, name: 'News' },
			{ id: 2, name: 'dev' },
			{ name: 'AI' },
		]);
	});
	it('remove drops listed names case-insensitively', () => {
		expect(mergeTags(tags, ['NEWS'], 'remove')).toEqual([{ id: 2, name: 'dev' }]);
	});
	it('replace sets exactly the list, reusing known ids', () => {
		expect(mergeTags(tags, ['DEV', 'x', 'X'], 'replace')).toEqual([
			{ id: 2, name: 'dev' },
			{ name: 'x' },
		]);
		expect(mergeTags(tags, [], 'replace')).toEqual([]);
	});
});

describe('buildLinkUpdateBody', () => {
	it('preserves every untouched field', () => {
		expect(buildLinkUpdateBody(current, { name: 'Renamed' })).toEqual({
			id: 42,
			name: 'Renamed',
			url: 'https://links.example.com/article',
			description: 'Saved for later',
			icon: null,
			iconWeight: null,
			color: null,
			collection: { id: 3, ownerId: 1 },
			tags: [
				{ id: 1, name: 'News' },
				{ id: 2, name: 'dev' },
			],
		});
	});
	it('never sends pinnedBy on a normal update', () => {
		expect(buildLinkUpdateBody(current, { color: '#fff' })).not.toHaveProperty('pinnedBy');
	});
	it('builds pin and unpin bodies', () => {
		expect(buildPinBody(current, 9, true).pinnedBy).toEqual([{ id: 9 }]);
		expect(buildPinBody(current, 9, false).pinnedBy).toEqual([{}]);
		expect(buildPinBody(current, 9, true).tags).toHaveLength(2);
	});
});

describe('Link Update operation', () => {
	const routes =
		(seen: string[]): Responder =>
		({ method, url, body }) => {
			seen.push(`${method} ${url.replace('https://links.example.com', '')}`);
			if (method === 'GET' && url.endsWith('/api/v1/links/42'))
				return { body: { response: current } };
			if (method === 'GET' && url.endsWith('/api/v1/collections/5')) {
				return { body: { response: { id: 5, name: 'Archive', ownerId: 7 } } };
			}
			if (method === 'PUT') return { body: { response: body } };
			throw new Error(`unexpected ${method} ${url}`);
		};

	it('gets, merges and puts with the chosen tag mode', async () => {
		const seen: string[] = [];
		const ctx = mockContext(routes(seen), {
			linkId: '42',
			simplify: false,
			updateFields: { tags: 'dev, ml', tagMode: 'replace', description: 'New note' },
		});
		const [out] = await linkOperations.update.call(ctx, 0, {});
		expect(seen).toEqual(['GET /api/v1/links/42', 'PUT /api/v1/links/42']);
		expect(out.json).toMatchObject({
			name: 'Example Article',
			description: 'New note',
			tags: [{ id: 2, name: 'dev' }, { name: 'ml' }],
		});
	});

	it('defaults to add mode', async () => {
		const ctx = mockContext(routes([]), {
			linkId: 42,
			simplify: false,
			updateFields: { tags: 'ml' },
		});
		const [out] = await linkOperations.update.call(ctx, 0, {});
		expect(out.json.tags).toHaveLength(3);
	});

	it('moving fetches the target collection owner', async () => {
		const seen: string[] = [];
		const ctx = mockContext(routes(seen), {
			linkId: 42,
			simplify: false,
			updateFields: { collection: { __rl: true, mode: 'id', value: '5' } },
		});
		const [out] = await linkOperations.update.call(ctx, 0, {});
		expect(seen).toContain('GET /api/v1/collections/5');
		expect(out.json.collection).toEqual({ id: 5, ownerId: 7 });
	});

	it('errors when no update field is set', async () => {
		const ctx = mockContext(routes([]), { linkId: 42, updateFields: { tagMode: 'replace' } });
		await expect(linkOperations.update.call(ctx, 0, {})).rejects.toThrow(
			'Add at least one field to update',
		);
		expect(calls(ctx)).toHaveLength(0);
	});
});
