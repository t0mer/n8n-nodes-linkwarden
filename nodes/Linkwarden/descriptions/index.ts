import type { INodeProperties } from 'n8n-workflow';

import { archiveFields, archiveOperations } from './ArchiveDescription';
import { collectionFields, collectionOperations } from './CollectionDescription';
import { highlightFields, highlightOperations } from './HighlightDescription';
import { linkFields, linkOperations } from './LinkDescription';
import { rssFields, rssOperations } from './RssDescription';
import { tagFields, tagOperations } from './TagDescription';
import { userFields, userOperations } from './UserDescription';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Archive', value: 'archive' },
		{ name: 'Collection', value: 'collection' },
		{ name: 'Highlight', value: 'highlight' },
		{ name: 'Link', value: 'link' },
		{ name: 'RSS Subscription', value: 'rssSubscription' },
		{ name: 'Tag', value: 'tag' },
		{ name: 'User', value: 'user' },
	],
	default: 'link',
};

export const resourceProperties: INodeProperties[] = [
	...archiveOperations,
	...archiveFields,
	...collectionOperations,
	...collectionFields,
	...highlightOperations,
	...highlightFields,
	...linkOperations,
	...linkFields,
	...rssOperations,
	...rssFields,
	...tagOperations,
	...tagFields,
	...userOperations,
	...userFields,
];
