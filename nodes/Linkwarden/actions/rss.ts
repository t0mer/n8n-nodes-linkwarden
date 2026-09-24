import { NodeOperationError, type IDataObject } from 'n8n-workflow';

import {
	findCollectionsByName,
	getAllCollections,
	parseId,
	resolveCollectionId,
} from '../../../shared/locators';
import { linkwardenRequest } from '../../../shared/transport';
import type { RssSubscription } from '../../../shared/types';
import { getLocator, requestOptions, toItems, type OperationHandler } from './utils';

const MAX_NAME_LENGTH = 50;

const create: OperationHandler = async function (i) {
	const name = (this.getNodeParameter('name', i) as string).trim();
	if (!name || name.length > MAX_NAME_LENGTH) {
		throw new NodeOperationError(
			this.getNode(),
			`Name must be 1–${MAX_NAME_LENGTH} characters, got ${name.length}`,
			{ itemIndex: i },
		);
	}
	const url = (this.getNodeParameter('url', i) as string).trim();
	const collection = getLocator(this, 'collection', i);
	if (!collection) {
		throw new NodeOperationError(this.getNode(), 'Select a collection', { itemIndex: i });
	}

	const body: IDataObject = { name, url };
	if (collection.mode !== 'name') {
		body.collectionId = parseId(this, collection.value, 'Collection', i);
	} else {
		// The server matches collectionName case-sensitively and creates a new collection
		// otherwise, so reuse an existing one (ignoring case) and only send the name when
		// none exists.
		const matches = findCollectionsByName(await getAllCollections(this, i), collection.value);
		if (matches.length === 1) body.collectionId = matches[0].id;
		else if (matches.length === 0) body.collectionName = collection.value;
		else body.collectionId = await resolveCollectionId(this, collection, i);
	}

	return toItems(
		await linkwardenRequest<RssSubscription>(
			this,
			'POST',
			'/api/v1/rss',
			requestOptions(this, i, { body }),
		),
	);
};

const getAll: OperationHandler = async function (i) {
	const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
	const limit = this.getNodeParameter('limit', i, 50) as number;
	const subscriptions = await linkwardenRequest<RssSubscription[]>(
		this,
		'GET',
		'/api/v1/rss',
		requestOptions(this, i),
	);
	return toItems(returnAll ? subscriptions : subscriptions.slice(0, limit));
};

const deleteSubscription: OperationHandler = async function (i) {
	const id = parseId(this, this.getNodeParameter('subscriptionId', i), 'Subscription ID', i);
	await linkwardenRequest(
		this,
		'DELETE',
		`/api/v1/rss/${id}`,
		requestOptions(this, i, { messages: { 404: `RSS subscription ${id} not found` } }),
	);
	return toItems({ id, deleted: true });
};

export const rssOperations: Record<string, OperationHandler> = {
	create,
	delete: deleteSubscription,
	getAll,
};
