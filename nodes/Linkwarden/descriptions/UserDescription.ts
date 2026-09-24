import type { INodeProperties } from 'n8n-workflow';

import { show } from './common';

export const userOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['user'] } },
		options: [
			{
				name: 'Get Me',
				value: 'getMe',
				description: 'Get the account that owns the access token',
				action: 'Get the current user',
			},
		],
		default: 'getMe',
	},
];

export const userFields: INodeProperties[] = [
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		displayOptions: { show: show('user', ['getMe']) },
	},
];
