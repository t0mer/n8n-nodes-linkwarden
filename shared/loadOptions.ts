import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { collectionPaths, getAllCollections } from './locators';
import { paginate } from './paginate';
import type { Tag } from './types';

const TAG_LIST_LIMIT = 500;

export async function searchCollections(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const collections = await getAllCollections(this);
	const paths = collectionPaths(collections);
	const needle = filter?.trim().toLowerCase();
	const results = collections
		.map((c) => ({ name: paths.get(c.id) ?? c.name, value: c.id }))
		.filter((c) => !needle || c.name.toLowerCase().includes(needle))
		.sort((a, b) => a.name.localeCompare(b.name));
	return { results };
}

export async function searchTags(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const qs = filter?.trim() ? { search: filter.trim() } : {};
	const { items } = await paginate<Tag>(this, 'nextCursor', '/api/v1/tags', qs, {
		itemsKey: 'tags',
		limit: TAG_LIST_LIMIT,
	});
	const results = items
		.map((t) => ({ name: t.name, value: t.id }))
		.sort((a, b) => a.name.localeCompare(b.name));
	return { results };
}
