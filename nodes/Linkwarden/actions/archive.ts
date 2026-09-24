import type { IDataObject } from 'n8n-workflow';

import { ARCHIVE_FORMATS } from '../../../shared/constants';
import { parseId } from '../../../shared/locators';
import { linkwardenRequestFull } from '../../../shared/transport';
import { requestOptions, type OperationHandler } from './utils';

const EXTENSIONS: Record<string, string> = {
	'application/json': 'json',
	'application/pdf': 'pdf',
	'image/jpeg': 'jpeg',
	'image/png': 'png',
	'text/html': 'html',
};

function headerValue(headers: IDataObject, name: string): string | undefined {
	const value = headers[name] ?? headers[name.toLowerCase()];
	return typeof value === 'string' ? value : undefined;
}

const download: OperationHandler = async function (i) {
	const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
	const format = this.getNodeParameter('format', i) as number;
	const preview = this.getNodeParameter('preview', i, false) as boolean;
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
	const options = this.getNodeParameter('archiveOptions', i, {}) as IDataObject;
	const info = ARCHIVE_FORMATS[format];

	// The server treats `preview` as true whenever it's present, so only send it when wanted.
	const qs: IDataObject = { format };
	if (preview) qs.preview = 'true';

	const response = await linkwardenRequestFull<Buffer>(
		this,
		'GET',
		`/api/v1/archives/${linkId}`,
		requestOptions(this, i, {
			qs,
			binary: true,
			messages: {
				404: `This link has no ${preview ? 'preview' : info.label} archive yet. Try Re-Archive or another format.`,
			},
		}),
	);

	const mimeType =
		headerValue(response.headers, 'content-type')?.split(';')[0].trim() || info.mimeType;
	const extension = preview ? (EXTENSIONS[mimeType] ?? 'jpeg') : info.extension;
	const fileName = `linkwarden-${linkId}${preview ? '-preview' : ''}.${extension}`;
	const binary = await this.helpers.prepareBinaryData(response.data, fileName, mimeType);

	const json: IDataObject = {
		linkId,
		format,
		formatName: preview ? 'Preview' : info.label,
		fileName,
		mimeType,
		fileSize: response.data.length,
	};
	if (format === 3 && !preview && options.parseReadable !== false) {
		try {
			json.readable = JSON.parse(response.data.toString('utf8')) as IDataObject;
		} catch {
			json.readable = null;
		}
	}
	return [{ json, binary: { [binaryPropertyName]: binary } }];
};

export const archiveOperations: Record<string, OperationHandler> = { download };
