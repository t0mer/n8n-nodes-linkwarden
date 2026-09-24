import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

import { searchCollections, searchTags } from '../../shared/loadOptions';
import { handlers, RUN_ONCE_OPERATIONS } from './actions';
import type { ExecutionCache } from './actions/utils';
import { resourceProperties, resourceProperty } from './descriptions';

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
			resourceProperty,
			...resourceProperties,
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
					// Both constructors return an existing instance of their own class unchanged, so this
					// keeps NodeApiError (and its HTTP status) as-is and wraps anything else.
					if (error instanceof NodeApiError) {
						throw new NodeApiError(this.getNode(), error as unknown as JsonObject);
					}
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
