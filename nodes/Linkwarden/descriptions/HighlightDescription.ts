import type { INodeProperties } from 'n8n-workflow';

import { idField, show } from './common';

export const highlightOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['highlight'] } },
		options: [
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a highlight',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a highlight',
				action: 'Delete a highlight',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the highlights of a link',
				action: 'Get many highlights',
			},
		],
		default: 'getAll',
	},
];

export const highlightFields: INodeProperties[] = [
	idField(
		'linkId',
		'Link ID',
		'Numeric ID of the link, e.g. 42',
		show('highlight', ['getAll', 'upsert']),
	),
	idField(
		'highlightId',
		'Highlight ID',
		'Numeric ID of the highlight, e.g. 7',
		show('highlight', ['delete']),
	),
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		default: '',
		required: true,
		description:
			'The highlighted text, exactly as it appears in the readable view (max 2048 characters)',
		displayOptions: { show: show('highlight', ['upsert']) },
	},
	{
		displayName: 'Start Offset',
		name: 'startOffset',
		type: 'number',
		default: 0,
		required: true,
		typeOptions: { minValue: 0 },
		description: 'Character position where the highlight starts in the readable text',
		displayOptions: { show: show('highlight', ['upsert']) },
	},
	{
		displayName: 'End Offset',
		name: 'endOffset',
		type: 'number',
		default: 0,
		required: true,
		typeOptions: { minValue: 0 },
		description: 'Character position where the highlight ends in the readable text',
		displayOptions: { show: show('highlight', ['upsert']) },
	},
	{
		displayName: 'Color',
		name: 'color',
		type: 'options',
		default: 'yellow',
		description: 'Highlight color. The Linkwarden reader shows yellow, red, blue and green.',
		displayOptions: { show: show('highlight', ['upsert']) },
		options: [
			{ name: 'Blue', value: 'blue' },
			{ name: 'Custom', value: 'custom' },
			{ name: 'Green', value: 'green' },
			{ name: 'Red', value: 'red' },
			{ name: 'Yellow', value: 'yellow' },
		],
	},
	{
		displayName: 'Custom Color',
		name: 'customValue',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. purple',
		description: 'Any color value up to 50 characters. The Linkwarden reader may not display it.',
		displayOptions: { show: { ...show('highlight', ['upsert']), color: ['custom'] } },
	},
	{
		displayName: 'Comment',
		name: 'comment',
		type: 'string',
		default: '',
		typeOptions: { rows: 2 },
		description: 'An optional note on the highlight',
		displayOptions: { show: show('highlight', ['upsert']) },
	},
];
