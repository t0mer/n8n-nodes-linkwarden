import type { INodeProperties } from 'n8n-workflow';

import { idField, show } from './common';

export const archiveOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['archive'] } },
		options: [
			{
				name: 'Download',
				value: 'download',
				description: 'Download a preserved copy of a link as a file',
				action: 'Download an archive',
			},
		],
		default: 'download',
	},
];

export const archiveFields: INodeProperties[] = [
	idField('linkId', 'Link ID', 'Numeric ID of the link, e.g. 42', show('archive', ['download'])),
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		default: 2,
		description: 'Which preserved copy to download',
		displayOptions: { show: show('archive', ['download']) },
		options: [
			{ name: 'PDF', value: 2 },
			{ name: 'Readable (JSON)', value: 3 },
			{ name: 'Screenshot (JPEG)', value: 1 },
			{ name: 'Screenshot (PNG)', value: 0 },
			{ name: 'Single-File HTML', value: 4 },
		],
	},
	{
		displayName: 'Preview',
		name: 'preview',
		type: 'boolean',
		default: false,
		description: 'Whether to download the small preview image instead of the full archive',
		displayOptions: { show: show('archive', ['download']) },
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the output binary field to put the file in',
		displayOptions: { show: show('archive', ['download']) },
	},
	{
		displayName: 'Options',
		name: 'archiveOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: show('archive', ['download']) },
		options: [
			{
				displayName: 'Parse Readable Content',
				name: 'parseReadable',
				type: 'boolean',
				default: true,
				description:
					'Whether to also parse the Readable (JSON) archive into the "readable" output field',
			},
		],
	},
];
