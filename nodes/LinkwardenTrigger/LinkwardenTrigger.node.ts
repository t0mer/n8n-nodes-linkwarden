import {
	NodeConnectionTypes,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { searchCollections, searchTags } from '../../shared/loadOptions';
import { parseId, readLocator, resolveCollectionId } from '../../shared/locators';
import { simplifyLink } from '../../shared/simplify';
import { pollNewLinks, sampleLinks, type TriggerFilters } from '../../shared/trigger';
import type { Link } from '../../shared/types';

const MAX_PER_POLL = 500;

export class LinkwardenTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Linkwarden Trigger',
		name: 'linkwardenTrigger',
		icon: { light: 'file:linkwarden.svg', dark: 'file:linkwarden.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{"New link"}}',
		description: 'Starts the workflow when a new link is saved in Linkwarden',
		defaults: { name: 'Linkwarden Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'linkwardenApi', required: true }],
		properties: [
			{
				displayName:
					'Linkwarden has no webhooks, so this trigger polls. Every 5–15 minutes is usually enough.',
				name: 'pollingNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				default: 'newLink',
				options: [
					{
						name: 'New Link',
						value: 'newLink',
						description: 'A link was saved. The first activation only records the newest link.',
					},
				],
			},
			{
				displayName: 'Collection',
				name: 'collection',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description: 'Only trigger for links in this collection. Leave empty for all collections.',
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
						placeholder: 'e.g. Read Later',
					},
				],
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description: 'Only trigger for links with this tag. Leave empty for any tag.',
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
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Subcollections',
						name: 'includeSubcollections',
						type: 'boolean',
						default: false,
						description:
							'Whether to also trigger for links in collections inside the selected collection',
					},
					{
						displayName: 'Max Links per Poll',
						name: 'maxPerPoll',
						type: 'number',
						default: 100,
						typeOptions: { minValue: 1, maxValue: MAX_PER_POLL },
						description:
							'Most links to emit per poll. When more arrive, the newest are emitted and the last item gets truncated: true.',
					},
				],
			},
		],
	};

	methods = {
		listSearch: { searchCollections, searchTags },
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const simplify = this.getNodeParameter('simplify', true) as boolean;
		const maxPerPoll = Math.min(
			Math.max(Number(options.maxPerPoll ?? 100) || 100, 1),
			MAX_PER_POLL,
		);

		const filters: TriggerFilters = {
			includeSubcollections: options.includeSubcollections === true,
		};
		const collection = readLocator(this.getNodeParameter('collection', ''));
		if (collection) filters.collectionId = await resolveCollectionId(this, collection);
		const tag = readLocator(this.getNodeParameter('tag', ''));
		if (tag) filters.tagId = parseId(this, tag.value, 'Tag');

		const toJson = (link: Link): IDataObject => (simplify ? simplifyLink(link) : link);

		if (this.getMode() === 'manual') {
			const samples = await sampleLinks(this, filters);
			return samples.length > 0 ? [this.helpers.returnJsonArray(samples.map(toJson))] : null;
		}

		const { links, truncated } = await pollNewLinks(
			this,
			this.getWorkflowStaticData('node'),
			filters,
			maxPerPoll,
		);
		if (links.length === 0) return null;
		const items = links.map(toJson);
		if (truncated) items[items.length - 1] = { ...items[items.length - 1], truncated: true };
		return [this.helpers.returnJsonArray(items)];
	}
}
