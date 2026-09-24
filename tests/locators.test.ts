import { describe, expect, it } from 'vitest';

import { searchCollections, searchTags } from '../shared/loadOptions';
import {
	collectionPaths,
	parseId,
	parseIdList,
	parseNameList,
	readLocator,
	resolveCollectionId,
} from '../shared/locators';
import { calls, mockContext } from './helpers';

const collections = [
	{ id: 1, name: 'Unorganized', ownerId: 1, parentId: null },
	{ id: 2, name: 'Work', ownerId: 1, parentId: null },
	{ id: 3, name: 'Reading', ownerId: 1, parentId: 2 },
	{ id: 4, name: 'Reading', ownerId: 1, parentId: null },
	{ id: 5, name: 'Papers', ownerId: 1, parentId: 3 },
];

describe('parseId / parseIdList / parseNameList', () => {
	const ctx = mockContext([]);
	it('accepts numbers and numeric strings', () => {
		expect(parseId(ctx, 5, 'Link ID')).toBe(5);
		expect(parseId(ctx, ' 42 ', 'Link ID')).toBe(42);
	});
	it('names the field and value on error', () => {
		expect(() => parseId(ctx, 'abc', 'Link ID')).toThrow(
			'"Link ID" must be a positive whole number, got "abc"',
		);
		expect(() => parseId(ctx, 0, 'Link ID')).toThrow();
		expect(() => parseId(ctx, '1.5', 'Link ID')).toThrow();
	});
	it('parses id lists and dedupes', () => {
		expect(parseIdList(ctx, '1, 2 3,,2', 'Link IDs')).toEqual([1, 2, 3]);
		expect(parseIdList(ctx, [4, '5'], 'Link IDs')).toEqual([4, 5]);
		expect(parseIdList(ctx, 7, 'Link IDs')).toEqual([7]);
		expect(() => parseIdList(ctx, '', 'Link IDs')).toThrow('needs at least one ID');
	});
	it('parses name lists', () => {
		expect(parseNameList(' a, b ,,c')).toEqual(['a', 'b', 'c']);
		expect(parseNameList(['x ', ' y'])).toEqual(['x', 'y']);
	});
});

describe('readLocator', () => {
	it('normalizes resource locator values', () => {
		expect(readLocator({ __rl: true, mode: 'list', value: 3 })).toEqual({
			mode: 'list',
			value: '3',
		});
		expect(readLocator({ __rl: true, mode: 'id', value: '' })).toBeUndefined();
		expect(readLocator('')).toBeUndefined();
		expect(readLocator(9)).toEqual({ mode: 'id', value: '9' });
	});
});

describe('collectionPaths', () => {
	it('builds Parent / Child paths', () => {
		const paths = collectionPaths(collections);
		expect(paths.get(5)).toBe('Work / Reading / Papers');
		expect(paths.get(4)).toBe('Reading');
	});
	it('survives parent cycles', () => {
		const paths = collectionPaths([
			{ id: 1, name: 'A', ownerId: 1, parentId: 2 },
			{ id: 2, name: 'B', ownerId: 1, parentId: 1 },
		]);
		expect(paths.get(1)).toBeDefined();
	});
});

describe('resolveCollectionId', () => {
	it('uses the id directly for list and id modes', async () => {
		const ctx = mockContext([]);
		expect(await resolveCollectionId(ctx, { mode: 'list', value: '3' })).toBe(3);
		expect(calls(ctx)).toHaveLength(0);
	});
	it('matches a unique name case-insensitively', async () => {
		const ctx = mockContext([{ body: { response: collections } }]);
		expect(await resolveCollectionId(ctx, { mode: 'name', value: 'work' })).toBe(2);
	});
	it('matches a full path', async () => {
		const ctx = mockContext([{ body: { response: collections } }]);
		expect(await resolveCollectionId(ctx, { mode: 'name', value: 'Work / Reading' })).toBe(3);
	});
	it('errors on zero matches', async () => {
		const ctx = mockContext([{ body: { response: collections } }]);
		await expect(resolveCollectionId(ctx, { mode: 'name', value: 'Nope' })).rejects.toThrow(
			'No collection named "Nope"',
		);
	});
	it('errors on multiple matches, listing ids', async () => {
		const ctx = mockContext([{ body: { response: collections } }]);
		await expect(resolveCollectionId(ctx, { mode: 'name', value: 'reading' })).rejects.toThrow(
			/Work \/ Reading \(ID 3\), Reading \(ID 4\)/,
		);
	});
});

describe('list search', () => {
	it('lists collections as sorted paths with filter', async () => {
		const ctx = mockContext([{ body: { response: collections } }]);
		const { results } = await searchCollections.call(ctx, 'read');
		expect(results).toEqual([
			{ name: 'Reading', value: 4 },
			{ name: 'Work / Reading', value: 3 },
			{ name: 'Work / Reading / Papers', value: 5 },
		]);
	});
	it('searches tags with the search param', async () => {
		const ctx = mockContext([
			{
				body: {
					data: {
						tags: [
							{ id: 2, name: 'news' },
							{ id: 1, name: 'dev' },
						],
						nextCursor: null,
					},
				},
			},
		]);
		const { results } = await searchTags.call(ctx, ' de ');
		expect(results).toEqual([
			{ name: 'dev', value: 1 },
			{ name: 'news', value: 2 },
		]);
		expect(calls(ctx)[0].qs).toEqual({ search: 'de' });
	});
});
