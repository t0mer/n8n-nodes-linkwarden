import type { INodeProperties } from 'n8n-workflow';

import { show, simplifyField } from './common';

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

export const userFields: INodeProperties[] = [simplifyField(show('user', ['getMe']))];
