import { NodeOperationError, type IDataObject, type IExecuteFunctions } from 'n8n-workflow';

import { ARCHIVE_FORMATS } from '../../../shared/constants';
import { parseId } from '../../../shared/locators';
import { linkwardenRequest, linkwardenRequestFull } from '../../../shared/transport';
import type { Link } from '../../../shared/types';
import { requestOptions, toItems, type OperationHandler } from './utils';

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

const UPLOAD_LIMIT_HINT =
	'The server rejects files over its upload limit (NEXT_PUBLIC_MAX_FILE_BUFFER, 10 MB by default).';

const PREVIEW_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

/** Reads the input file, checks its MIME type against the format, and builds the multipart body. */
async function uploadForm(
	ctx: IExecuteFunctions,
	i: number,
	format: number,
	preview: boolean,
): Promise<FormData> {
	const binaryPropertyName = ctx.getNodeParameter('binaryPropertyName', i, 'data') as string;
	const file = ctx.helpers.assertBinaryData(i, binaryPropertyName);
	const info = ARCHIVE_FORMATS[format];
	const mimeType = (file.mimeType ?? '').split(';')[0].trim().toLowerCase();
	const allowed = preview ? PREVIEW_MIME_TYPES : (info?.uploadMimeTypes ?? []);
	if (!allowed.includes(mimeType)) {
		throw new NodeOperationError(
			ctx.getNode(),
			`The file in "${binaryPropertyName}" is ${mimeType || 'of unknown type'}, but ${preview ? 'a preview' : `the ${info?.label ?? format} format`} needs ${allowed.join(' or ') || 'a different format'}`,
			{ itemIndex: i },
		);
	}
	const buffer = await ctx.helpers.getBinaryDataBuffer(i, binaryPropertyName);
	const form = new FormData();
	form.append(
		'file',
		new Blob([new Uint8Array(buffer)], { type: mimeType }),
		file.fileName ?? `upload.${info?.extension ?? 'bin'}`,
	);
	return form;
}

const upload: OperationHandler = async function (i) {
	const linkId = parseId(this, this.getNodeParameter('linkId', i), 'Link ID', i);
	const format = this.getNodeParameter('format', i) as number;
	const preview = this.getNodeParameter('preview', i, false) as boolean;
	const body = await uploadForm(this, i, format, preview);
	const qs: IDataObject = { format };
	if (preview) qs.preview = 'true';
	const link = await linkwardenRequest<Link>(
		this,
		'POST',
		`/api/v1/archives/${linkId}`,
		requestOptions(this, i, {
			qs,
			body,
			messages: { 404: `Link ${linkId} not found` },
			hints: { 400: UPLOAD_LIMIT_HINT, 413: UPLOAD_LIMIT_HINT },
		}),
	);
	return toItems(link);
};

const uploadNew: OperationHandler = async function (i) {
	const format = this.getNodeParameter('format', i) as number;
	const url = (this.getNodeParameter('url', i, '') as string).trim();
	const body = await uploadForm(this, i, format, false);
	if (url) body.append('url', url);
	const link = await linkwardenRequest<Link>(
		this,
		'POST',
		'/api/v1/archives',
		requestOptions(this, i, {
			qs: { format },
			body,
			hints: { 400: UPLOAD_LIMIT_HINT, 413: UPLOAD_LIMIT_HINT },
		}),
	);
	return toItems(link);
};

export const archiveOperations: Record<string, OperationHandler> = { download, upload, uploadNew };
