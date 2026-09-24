import type { INodeProperties } from 'n8n-workflow';

import {
	collectionLocator,
	idField,
	linkSortField,
	returnAllAndLimit,
	show,
	tagLocator,
} from './common';

export const linkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['link'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a link by ID',
				action: 'Get a link',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List links, optionally filtered by collection, tag, or pinned state',
				action: 'Get many links',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search links by text, with optional filters',
				action: 'Search links',
			},
		],
		default: 'getAll',
	},
];

const linkFilters = (operations: string[]): INodeProperties => ({
	displayName: 'Filters',
	name: 'filters',
	type: 'collection',
	placeholder: 'Add Filter',
	default: {},
	displayOptions: { show: show('link', operations) },
	options: [
		collectionLocator({
			name: 'collection',
			displayName: 'Collection',
			description: 'Only return links in this collection',
		}),
		{
			displayName: 'Pinned Only',
			name: 'pinnedOnly',
			type: 'boolean',
			default: false,
			description: 'Whether to only return links you have pinned',
		},
		tagLocator({
			name: 'tag',
			displayName: 'Tag',
			description: 'Only return links with this tag',
		}),
	],
});

export const linkFields: INodeProperties[] = [
	idField('linkId', 'Link ID', 'Numeric ID of the link, e.g. 42', show('link', ['get'])),

	// Search
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. kubernetes tag:devops',
		description:
			'Text to search for in link names, URLs, descriptions and tags. With Meilisearch enabled on the server you can also filter with lowercase field tokens followed by a colon: name, description, URL, type, collection, tag, pinned, public, before, after (e.g. "tag:news after:2025-01-01"). Without Meilisearch this is a plain "contains" match.',
		displayOptions: { show: show('link', ['search']) },
	},

	// Get Many + Search
	...returnAllAndLimit(show('link', ['getAll', 'search'])),
	linkSortField(show('link', ['getAll', 'search'])),
	linkFilters(['getAll', 'search']),
];
