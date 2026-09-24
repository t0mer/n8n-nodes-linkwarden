import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { searchCollections, searchTags } from '../../shared/loadOptions';
import { linkOperations } from './actions/link';
import type { ExecutionCache, OperationHandler } from './actions/utils';
import {
	linkFields,
	linkOperations as linkOperationProperties,
} from './descriptions/LinkDescription';

const handlers: Record<string, Record<string, OperationHandler>> = {
	link: linkOperations,
};

/** Operations that can read their input from the first item only and run a single request. */
const RUN_ONCE_OPERATIONS = new Set<string>([
	'link.bulkUpdate',
	'link.deleteArchives',
	'link.deleteMany',
]);

export class Linkwarden implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Linkwarden',
		name: 'linkwarden',
		icon: { light: 'file:linkwarden.svg', dark: 'file:linkwarden.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Save, organize, search and archive bookmarks in Linkwarden',
		defaults: { name: 'Linkwarden' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'linkwardenApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Link', value: 'link' }],
				default: 'link',
			},
			...linkOperationProperties,
			...linkFields,
			{
				displayName: 'Request Options',
				name: 'requestOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						default: 3,
						typeOptions: { minValue: 0, maxValue: 10 },
						description:
							'How many times to retry on rate limiting (429), server errors (5xx) and network errors',
					},
				],
			},
		],
	};

	methods = {
		listSearch: { searchCollections, searchTags },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const cache: ExecutionCache = {};

		for (let i = 0; i < items.length; i++) {
			let runOnce = false;
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const handler = handlers[resource]?.[operation];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex: i },
					);
				}
				runOnce =
					RUN_ONCE_OPERATIONS.has(`${resource}.${operation}`) &&
					(this.getNodeParameter('runOnce', i, true) as boolean);

				const results = await handler.call(this, i, cache);
				for (const result of results) {
					returnData.push({ ...result, pairedItem: { item: i } });
				}
			} catch (error) {
				if (!this.continueOnFail()) {
					// Our errors are already NodeApiError/NodeOperationError; wrapping returns the same instance.
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				}
				const failure: IDataObject = {
					error: (error as Error).message,
					input: items[i].json,
				};
				const httpCode = (error as { httpCode?: string | null }).httpCode;
				if (httpCode) failure.statusCode = Number(httpCode);
				returnData.push({ json: failure, pairedItem: { item: i } });
			}
			if (runOnce) break;
		}

		return [returnData];
	}
}
