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
			{
				name: 'Upload as New Link',
				value: 'uploadNew',
				description: 'Create a new link from a file (saved in your default collection)',
				action: 'Upload a file as a new link',
			},
			{
				name: 'Upload to Link',
				value: 'upload',
				description: 'Attach a file as a preserved copy of an existing link',
				action: 'Upload an archive to a link',
			},
		],
		default: 'download',
	},
];

export const archiveFields: INodeProperties[] = [
	idField(
		'linkId',
		'Link ID',
		'Numeric ID of the link, e.g. 42',
		show('archive', ['download', 'upload']),
	),
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
		displayName: 'Format',
		name: 'format',
		type: 'options',
		default: 2,
		description:
			"What kind of file you are uploading. The file's MIME type must match: PNG image/png, JPEG image/jpeg, PDF application/pdf, HTML text/html.",
		displayOptions: { show: show('archive', ['upload', 'uploadNew']) },
		options: [
			{ name: 'PDF', value: 2 },
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
		displayName: 'As Preview Image',
		name: 'preview',
		type: 'boolean',
		default: false,
		description:
			"Whether to upload the file as the link's preview thumbnail instead of an archive (PNG or JPEG only)",
		displayOptions: { show: show('archive', ['upload']) },
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the input binary field containing the file to upload',
		displayOptions: { show: show('archive', ['upload', 'uploadNew']) },
	},
	{
		displayName: 'Source URL',
		name: 'url',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/report.pdf',
		description: 'Optional address the file came from, stored as the link URL',
		displayOptions: { show: show('archive', ['uploadNew']) },
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
