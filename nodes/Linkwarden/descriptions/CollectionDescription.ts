import type { INodeProperties } from 'n8n-workflow';

import {
	collectionLocator,
	colorField,
	iconField,
	iconWeightField,
	returnAllAndLimit,
	show,
} from './common';

export const collectionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['collection'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a collection',
				action: 'Create a collection',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: "Delete a collection and every link inside it. This can't be undone.",
				action: 'Delete a collection',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a collection',
				action: 'Get a collection',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List collections',
				action: 'Get many collections',
			},
			{
				name: 'Update',
				value: 'update',
				description:
					'Change fields of a collection. Fields you leave out keep their current values.',
				action: 'Update a collection',
			},
		],
		default: 'getAll',
	},
];

const descriptionField: INodeProperties = {
	displayName: 'Description',
	name: 'description',
	type: 'string',
	default: '',
	typeOptions: { rows: 3 },
	description: 'What the collection is for',
};

export const collectionFields: INodeProperties[] = [
	collectionLocator({
		name: 'collection',
		displayName: 'Collection',
		description: 'The collection to use',
		required: true,
		displayOptions: { show: show('collection', ['get', 'update']) },
	}),
	collectionLocator({
		name: 'collection',
		displayName: 'Collection',
		description:
			"The collection to delete. Every link inside it is deleted too. This can't be undone.",
		required: true,
		displayOptions: { show: show('collection', ['delete']) },
	}),

	// Create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Read Later',
		description: 'Name of the new collection',
		displayOptions: { show: show('collection', ['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('collection', ['create']) },
		options: [
			colorField,
			descriptionField,
			iconField,
			iconWeightField,
			collectionLocator({
				name: 'parent',
				displayName: 'Parent Collection',
				description: 'Create the collection inside this one',
			}),
		],
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: show('collection', ['update']) },
		options: [
			colorField,
			descriptionField,
			iconField,
			iconWeightField,
			{
				displayName: 'Is Public',
				name: 'isPublic',
				type: 'boolean',
				default: false,
				description: 'Whether anyone with the link can view the collection',
			},
			{
				displayName: 'Move to Top Level',
				name: 'moveToTopLevel',
				type: 'boolean',
				default: false,
				description:
					'Whether to take the collection out of its parent. Ignored when Parent Collection is set.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'New name of the collection',
			},
			collectionLocator({
				name: 'parent',
				displayName: 'Parent Collection',
				description: 'Move the collection inside this one',
			}),
		],
	},

	// Get Many
	...returnAllAndLimit(show('collection', ['getAll'])),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: show('collection', ['getAll']) },
		options: [
			collectionLocator({
				name: 'parent',
				displayName: 'Parent Collection',
				description: 'Only return direct sub-collections of this collection',
			}),
			{
				displayName: 'Top Level Only',
				name: 'topLevelOnly',
				type: 'boolean',
				default: false,
				description: 'Whether to only return collections that have no parent',
			},
		],
	},
];
