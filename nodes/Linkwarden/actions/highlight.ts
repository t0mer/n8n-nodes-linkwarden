import { NodeOperationError, type IDataObject } from 'n8n-workflow';

import { parseId } from '../../../shared/locators';
import { linkwardenRequest } from '../../../shared/transport';
import type { Highlight } from '../../../shared/types';
import { requestOptions, toItems, type OperationHandler } from './utils';

const upsert: OperationHandler = async function (i) {
	const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
	const startOffset = this.getNodeParameter('startOffset', i) as number;
	const endOffset = this.getNodeParameter('endOffset', i) as number;
	if (endOffset < startOffset) {
		throw new NodeOperationError(this.getNode(), 'End Offset must not be before Start Offset', {
			itemIndex: i,
		});
	}
	let color = this.getNodeParameter('color', i, 'yellow') as string;
	if (color === 'custom') color = (this.getNodeParameter('customValue', i) as string).trim();
	const comment = this.getNodeParameter('comment', i, '') as string;

	const body: IDataObject = {
		linkId,
		color,
		startOffset,
		endOffset,
		text: this.getNodeParameter('text', i) as string,
	};
	if (comment) body.comment = comment;
	return toItems(
		await linkwardenRequest<Highlight>(
			this,
			'POST',
			'/api/v1/highlights',
			requestOptions(this, i, { body }),
		),
	);
};

const getAll: OperationHandler = async function (i) {
	const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
	return toItems(
		await linkwardenRequest<Highlight[]>(
			this,
			'GET',
			`/api/v1/links/${linkId}/highlights`,
			requestOptions(this, i, { messages: { 404: `Link ${linkId} not found` } }),
		),
	);
};

const deleteHighlight: OperationHandler = async function (i) {
	const id = parseId(this, this.getNodeParameter('highlightId', i), 'Highlight ID', i);
	await linkwardenRequest(
		this,
		'DELETE',
		`/api/v1/highlights/${id}`,
		requestOptions(this, i, { messages: { 404: `Highlight ${id} not found` } }),
	);
	return toItems({ id, deleted: true });
};

export const highlightOperations: Record<string, OperationHandler> = {
	delete: deleteHighlight,
	getAll,
	upsert,
};
