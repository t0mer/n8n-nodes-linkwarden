import type { INodeProperties } from 'n8n-workflow';

import { collectionLocator, idField, returnAllAndLimit, show } from './common';

export const rssOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['rssSubscription'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Subscribe to an RSS feed; new entries are saved as links in a collection',
				action: 'Create an RSS subscription',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an RSS subscription. Links it already saved are kept.',
				action: 'Delete an RSS subscription',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List your RSS subscriptions',
				action: 'Get many RSS subscriptions',
			},
		],
		default: 'getAll',
	},
];

export const rssFields: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Hacker News',
		description: 'Name of the subscription (up to 50 characters, unique among your subscriptions)',
		displayOptions: { show: show('rssSubscription', ['create']) },
	},
	{
		displayName: 'Feed URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://news.ycombinator.com/rss',
		description: 'Address of the RSS or Atom feed',
		displayOptions: { show: show('rssSubscription', ['create']) },
	},
	collectionLocator({
		name: 'collection',
		displayName: 'Collection',
		description:
			"Collection that receives the feed entries. By Name creates the collection if it doesn't exist.",
		required: true,
		displayOptions: { show: show('rssSubscription', ['create']) },
	}),
	idField(
		'subscriptionId',
		'Subscription ID',
		'Numeric ID of the RSS subscription, e.g. 3',
		show('rssSubscription', ['delete']),
	),
	...returnAllAndLimit(show('rssSubscription', ['getAll'])),
];
