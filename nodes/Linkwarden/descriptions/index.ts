import type { INodeProperties } from 'n8n-workflow';

import { collectionFields, collectionOperations } from './CollectionDescription';
import { highlightFields, highlightOperations } from './HighlightDescription';
import { linkFields, linkOperations } from './LinkDescription';
import { tagFields, tagOperations } from './TagDescription';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Collection', value: 'collection' },
		{ name: 'Highlight', value: 'highlight' },
		{ name: 'Link', value: 'link' },
		{ name: 'Tag', value: 'tag' },
	],
	default: 'link',
};

export const resourceProperties: INodeProperties[] = [
	...collectionOperations,
	...collectionFields,
	...highlightOperations,
	...highlightFields,
	...linkOperations,
	...linkFields,
	...tagOperations,
	...tagFields,
];
