import type { INodeProperties } from 'n8n-workflow';

import { collectionFields, collectionOperations } from './CollectionDescription';
import { linkFields, linkOperations } from './LinkDescription';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Collection', value: 'collection' },
		{ name: 'Link', value: 'link' },
	],
	default: 'link',
};

export const resourceProperties: INodeProperties[] = [
	...collectionOperations,
	...collectionFields,
	...linkOperations,
	...linkFields,
];
