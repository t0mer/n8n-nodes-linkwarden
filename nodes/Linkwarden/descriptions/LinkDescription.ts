import type { INodeProperties } from 'n8n-workflow';

import {
	collectionLocator,
	colorField,
	iconField,
	iconWeightField,
	idField,
	linkSortField,
	runOnceField,
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
				name: 'Create',
				value: 'create',
				description: 'Save a URL as a new link, with duplicate handling',
				action: 'Create a link',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a link and its archives',
				action: 'Delete a link',
			},
			{
				name: 'Delete Many',
				value: 'deleteMany',
				description: 'Delete several links by ID in one request',
				action: 'Delete many links',
			},
			{
				name: 'Find by URL',
				value: 'findByUrl',
				description:
					'Check whether a URL is already saved. Returns found, matches and link; never fails when nothing matches.',
				action: 'Find links by URL',
			},
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
				name: 'Pin',
				value: 'pin',
				description: 'Pin a link to your dashboard',
				action: 'Pin a link',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search links by text, with optional filters',
				action: 'Search links',
			},
			{
				name: 'Unpin',
				value: 'unpin',
				description: 'Remove a link from your pinned links',
				action: 'Unpin a link',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change fields of a link. Fields you leave out keep their current values.',
				action: 'Update a link',
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

	// Delete Many
	{
		displayName: 'Link IDs',
		name: 'linkIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 12, 13, 20',
		description: 'Comma-separated link IDs (or an array of IDs)',
		displayOptions: { show: show('link', ['deleteMany']) },
	},
	runOnceField(show('link', ['deleteMany']), 'delete all of them'),

	// Create
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/article',
		description:
			'The web address to save. To save a file instead, use Archive → Upload as New Link.',
		displayOptions: { show: show('link', ['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('link', ['create']) },
		options: [
			collectionLocator({
				name: 'collection',
				displayName: 'Collection',
				description:
					'Collection to save the link in. Leave empty to use the default collection ("Unorganized").',
			}),
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'A note about the link',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Title of the link. Leave empty to let Linkwarden use the page title.',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				placeholder: 'e.g. news, to-read',
				description:
					"Comma-separated tag names (or an array of names). Tags that don't exist yet are created.",
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show('link', ['create']) },
		options: [
			{
				displayName: 'Check for Duplicates First',
				name: 'precheckDuplicate',
				type: 'boolean',
				default: false,
				description:
					'Whether to look for the URL before saving it. Use this when "Prevent duplicate links" is off in your Linkwarden settings, since the server only rejects duplicates when it is on.',
			},
			{
				displayName: 'On Duplicate',
				name: 'onDuplicate',
				type: 'options',
				default: 'returnExisting',
				description: 'What to do when the URL is already saved',
				options: [
					{
						name: 'Return Existing Link',
						value: 'returnExisting',
						description: 'Output the saved link with duplicate set to true',
					},
					{
						name: 'Skip',
						value: 'skip',
						description: 'Output nothing for this item',
					},
					{
						name: 'Throw Error',
						value: 'error',
						description: 'Fail the item',
					},
				],
			},
		],
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('link', ['update']) },
		options: [
			collectionLocator({
				name: 'collection',
				displayName: 'Collection',
				description:
					'Move the link to this collection. Only the owner of a collection can move links out of it.',
			}),
			colorField,
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				description: 'A note about the link',
			},
			iconField,
			iconWeightField,
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Title of the link',
			},
			{
				displayName: 'Tag Mode',
				name: 'tagMode',
				type: 'options',
				default: 'add',
				description: 'How the Tags field changes the tags already on the link',
				options: [
					{
						name: 'Add',
						value: 'add',
						description: 'Keep the current tags and add these',
					},
					{
						name: 'Remove',
						value: 'remove',
						description: 'Remove these tags and keep the rest',
					},
					{
						name: 'Replace',
						value: 'replace',
						description: 'Set exactly these tags (empty clears all tags)',
					},
				],
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				placeholder: 'e.g. news, to-read',
				description:
					'Comma-separated tag names (or an array of names), applied according to Tag Mode',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/article',
				description:
					'New address of the link. Changing it deletes the existing archives (screenshot, PDF, readable, HTML) and preserves the new page again.',
			},
		],
	},

	// Find by URL
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/article',
		description:
			'The URL to look for. Matching ignores letter case in the scheme and host, a leading "www.", trailing slashes and the #fragment.',
		displayOptions: { show: show('link', ['findByUrl']) },
	},
	collectionLocator({
		name: 'scope',
		displayName: 'Only in Collection',
		description: 'Only look for the URL in this collection. Leave empty to search everywhere.',
		displayOptions: { show: show('link', ['findByUrl']) },
	}),

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
