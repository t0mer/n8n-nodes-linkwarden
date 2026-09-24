import type { INodeProperties } from 'n8n-workflow';

export type DisplayFilter = { resource: string[]; operation: string[] };

export const show = (resource: string, operation: string[]): DisplayFilter => ({
	resource: [resource],
	operation,
});

interface LocatorOptions {
	name: string;
	displayName: string;
	description: string;
	required?: boolean;
	displayOptions?: INodeProperties['displayOptions'];
}

/** Collection picker: From List (shown as `Parent / Child`), By ID, By Name. */
export function collectionLocator(options: LocatorOptions): INodeProperties {
	return {
		displayName: options.displayName,
		name: options.name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: options.required,
		description: options.description,
		displayOptions: options.displayOptions,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a collection...',
				typeOptions: { searchListMethod: 'searchCollections', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 12',
				validation: [
					{
						type: 'regex',
						properties: { regex: '^\\s*\\d+\\s*$', errorMessage: 'Enter a numeric ID' },
					},
				],
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. Read Later or Work / Research',
			},
		],
	};
}

/** Tag picker: From List, By ID. */
export function tagLocator(options: LocatorOptions): INodeProperties {
	return {
		displayName: options.displayName,
		name: options.name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: options.required,
		description: options.description,
		displayOptions: options.displayOptions,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a tag...',
				typeOptions: { searchListMethod: 'searchTags', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 7',
				validation: [
					{
						type: 'regex',
						properties: { regex: '^\\s*\\d+\\s*$', errorMessage: 'Enter a numeric ID' },
					},
				],
			},
		],
	};
}

export function returnAllAndLimit(displayOptions: DisplayFilter): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show: displayOptions },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1 },
			description: 'Max number of results to return',
			displayOptions: { show: { ...displayOptions, returnAll: [false] } },
		},
	];
}

export function idField(
	name: string,
	displayName: string,
	description: string,
	displayOptions: DisplayFilter,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 42',
		description,
		displayOptions: { show: displayOptions },
	};
}

export function runOnceField(displayOptions: DisplayFilter, what: string): INodeProperties {
	return {
		displayName: 'Run Once',
		name: 'runOnce',
		type: 'boolean',
		default: true,
		description: `Whether to read the IDs from the first input item only and ${what} in a single request. Turn off to run once per input item.`,
		displayOptions: { show: displayOptions },
	};
}

export const linkSortField = (displayOptions: DisplayFilter): INodeProperties => ({
	displayName: 'Sort',
	name: 'sort',
	type: 'options',
	default: 0,
	description: 'Order of the returned links',
	displayOptions: { show: displayOptions },
	options: [
		{ name: 'Name (A–Z)', value: 2 },
		{ name: 'Name (Z–A)', value: 3 },
		{ name: 'Newest First', value: 0 },
		{ name: 'Oldest First', value: 1 },
	],
});

export const iconWeightField: INodeProperties = {
	displayName: 'Icon Weight',
	name: 'iconWeight',
	type: 'options',
	default: 'regular',
	description: 'Style of the icon',
	options: [
		{ name: 'Bold', value: 'bold' },
		{ name: 'Duotone', value: 'duotone' },
		{ name: 'Fill', value: 'fill' },
		{ name: 'Light', value: 'light' },
		{ name: 'Regular', value: 'regular' },
		{ name: 'Thin', value: 'thin' },
	],
};

export const iconField: INodeProperties = {
	displayName: 'Icon',
	name: 'icon',
	type: 'string',
	default: '',
	placeholder: 'e.g. bookmark',
	description:
		'Name of a Phosphor icon (https://phosphoricons.com), e.g. "bookmark" or "book-open"',
};

export const colorField: INodeProperties = {
	displayName: 'Color',
	name: 'color',
	type: 'color',
	default: '#0ea5e9',
	description: 'Color as a hex code, e.g. #0ea5e9',
};

export const simplifyField = (displayOptions: DisplayFilter): INodeProperties => ({
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	description: 'Whether to return a simplified version of the response instead of the raw data',
	displayOptions: { show: displayOptions },
});
