import type { INodeProperties } from 'n8n-workflow';

import { returnAllAndLimit, runOnceField, show, tagLocator } from './common';

export const tagOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['tag'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create one or more tags (existing names are updated)',
				action: 'Create tags',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a tag. Links keep existing without it.',
				action: 'Delete a tag',
			},
			{
				name: 'Delete Many',
				value: 'deleteMany',
				description: 'Delete several tags by ID in one request',
				action: 'Delete many tags',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a tag',
				action: 'Get a tag',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List tags, optionally filtered by name',
				action: 'Get many tags',
			},
			{
				name: 'Rename',
				value: 'rename',
				description: 'Rename a tag',
				action: 'Rename a tag',
			},
		],
		default: 'getAll',
	},
];

const archiveOverride = (displayName: string, name: string, what: string): INodeProperties => ({
	displayName,
	name,
	type: 'boolean',
	default: true,
	description: `Whether links with this tag are preserved as ${what}. Overrides your account setting.`,
});

export const tagFields: INodeProperties[] = [
	tagLocator({
		name: 'tag',
		displayName: 'Tag',
		description: 'The tag to use',
		required: true,
		displayOptions: { show: show('tag', ['delete', 'get', 'rename']) },
	}),

	// Create
	{
		displayName: 'Names',
		name: 'names',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. news, to-read',
		description: 'Comma-separated tag names (or an array of names), up to 50 characters each',
		displayOptions: { show: show('tag', ['create']) },
	},
	{
		displayName: 'Preservation Overrides',
		name: 'preservation',
		type: 'collection',
		placeholder: 'Add Override',
		default: {},
		description: 'Per-tag archive settings, applied to every name above',
		displayOptions: { show: show('tag', ['create']) },
		options: [
			{
				displayName: 'AI Tag',
				name: 'aiTag',
				type: 'boolean',
				default: true,
				description: 'Whether the AI tagger may assign this tag automatically',
			},
			archiveOverride('Archive as PDF', 'archiveAsPDF', 'a PDF'),
			archiveOverride('Archive as Readable', 'archiveAsReadable', 'readable text'),
			archiveOverride('Archive as Screenshot', 'archiveAsScreenshot', 'a screenshot'),
			archiveOverride(
				'Archive as Single-File HTML',
				'archiveAsMonolith',
				'a single-file HTML page',
			),
			archiveOverride(
				'Archive to Wayback Machine',
				'archiveAsWaybackMachine',
				'a snapshot on the Wayback Machine (archive.org)',
			),
		],
	},
	runOnceField(show('tag', ['create']), 'create all of them'),

	// Rename
	{
		displayName: 'New Name',
		name: 'newName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. reading-list',
		description: 'The new tag name (up to 50 characters, unique among your tags)',
		displayOptions: { show: show('tag', ['rename']) },
	},

	// Delete Many
	{
		displayName: 'Tag IDs',
		name: 'tagIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 3, 8, 12',
		description: 'Comma-separated tag IDs (or an array of IDs)',
		displayOptions: { show: show('tag', ['deleteMany']) },
	},
	runOnceField(show('tag', ['deleteMany']), 'delete all of them'),

	// Get Many
	...returnAllAndLimit(show('tag', ['getAll'])),
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		placeholder: 'e.g. news',
		description: 'Only return tags whose name contains this text',
		displayOptions: { show: show('tag', ['getAll']) },
	},
	{
		displayName: 'Sort',
		name: 'sort',
		type: 'options',
		default: 0,
		description: 'Order of the returned tags',
		displayOptions: { show: show('tag', ['getAll']) },
		options: [
			{ name: 'Fewest Links', value: 5 },
			{ name: 'Most Links', value: 4 },
			{ name: 'Name (A–Z)', value: 2 },
			{ name: 'Name (Z–A)', value: 3 },
			{ name: 'Newest First', value: 0 },
			{ name: 'Oldest First', value: 1 },
		],
	},
];
