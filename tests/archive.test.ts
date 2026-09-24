import { describe, expect, it, vi } from 'vitest';

import { archiveOperations } from '../nodes/Linkwarden/actions/archive';
import { calls, mockContext, type MockResponse } from './helpers';

function downloadCtx(response: MockResponse, params: Record<string, unknown>) {
	const ctx = mockContext([response], { binaryPropertyName: 'data', ...params });
	ctx.helpers.prepareBinaryData = vi.fn(
		async (data: Buffer, fileName: string, mimeType: string) => ({
			data: data.toString('base64'),
			fileName,
			mimeType,
		}),
	);
	return ctx;
}

describe('Archive Download', () => {
	it.each([
		[0, 'image/png', 'linkwarden-5.png'],
		[1, 'image/jpeg', 'linkwarden-5.jpeg'],
		[2, 'application/pdf', 'linkwarden-5.pdf'],
		[4, 'text/html', 'linkwarden-5.html'],
	])('format %i → %s, %s', async (format, mimeType, fileName) => {
		const ctx = downloadCtx(
			{ body: Buffer.from('FILE'), headers: { 'content-type': `${mimeType}; charset=utf-8` } },
			{ linkId: '5', format },
		);
		const [out] = await archiveOperations.download.call(ctx, 0, {});
		expect(calls(ctx)[0]).toMatchObject({
			url: 'https://links.example.com/api/v1/archives/5',
			qs: { format },
			encoding: 'arraybuffer',
		});
		expect(calls(ctx)[0].qs).not.toHaveProperty('preview');
		expect(ctx.helpers.prepareBinaryData).toHaveBeenCalledWith(
			Buffer.from('FILE'),
			fileName,
			mimeType,
		);
		expect(out.json).toMatchObject({ linkId: 5, format, fileName, mimeType, fileSize: 4 });
		expect(out.binary?.data).toMatchObject({ fileName });
	});

	it('falls back to the format MIME type without a content-type header', async () => {
		const ctx = downloadCtx({ body: Buffer.from('x') }, { linkId: 5, format: 2 });
		const [out] = await archiveOperations.download.call(ctx, 0, {});
		expect(out.json.mimeType).toBe('application/pdf');
	});

	it('parses the readable JSON archive', async () => {
		const readable = { title: 'T', content: '<p>x</p>' };
		const ctx = downloadCtx(
			{
				body: Buffer.from(JSON.stringify(readable)),
				headers: { 'content-type': 'application/json' },
			},
			{ linkId: 5, format: 3 },
		);
		const [out] = await archiveOperations.download.call(ctx, 0, {});
		expect(out.json.readable).toEqual(readable);
		expect(out.json.fileName).toBe('linkwarden-5.json');
	});

	it('skips parsing when parseReadable is off', async () => {
		const ctx = downloadCtx(
			{ body: Buffer.from('{}'), headers: { 'content-type': 'application/json' } },
			{ linkId: 5, format: 3, archiveOptions: { parseReadable: false } },
		);
		const [out] = await archiveOperations.download.call(ctx, 0, {});
		expect(out.json).not.toHaveProperty('readable');
	});

	it('sends preview only when true and names the file from the MIME type', async () => {
		const ctx = downloadCtx(
			{ body: Buffer.from('x'), headers: { 'content-type': 'image/jpeg' } },
			{ linkId: 5, format: 2, preview: true },
		);
		const [out] = await archiveOperations.download.call(ctx, 0, {});
		expect(calls(ctx)[0].qs).toEqual({ format: 2, preview: 'true' });
		expect(out.json.fileName).toBe('linkwarden-5-preview.jpeg');
	});

	it('maps 404 to a helpful message', async () => {
		const ctx = downloadCtx(
			{ statusCode: 404, body: Buffer.from('File not found.') },
			{ linkId: 5, format: 0 },
		);
		await expect(archiveOperations.download.call(ctx, 0, {})).rejects.toThrow(
			'This link has no Screenshot (PNG) archive yet. Try Re-Archive or another format.',
		);
	});
});

function uploadCtx(mimeType: string, params: Record<string, unknown>) {
	const ctx = mockContext([{ body: { response: { id: 9, pdf: 'archives/1/9.pdf' } } }], {
		binaryPropertyName: 'data',
		...params,
	});
	ctx.helpers.assertBinaryData = vi.fn(() => ({ mimeType, fileName: 'doc.bin', data: '' }));
	ctx.helpers.getBinaryDataBuffer = vi.fn(async () => Buffer.from('%PDF-1.4'));
	return ctx;
}

describe('Archive Upload', () => {
	it('uploads to a link as multipart with a typed file part', async () => {
		const ctx = uploadCtx('application/pdf', { linkId: '9', format: 2 });
		const [out] = await archiveOperations.upload.call(ctx, 0, {});
		const req = calls(ctx)[0];
		expect(req).toMatchObject({
			method: 'POST',
			url: 'https://links.example.com/api/v1/archives/9',
			qs: { format: 2 },
		});
		expect(req.json).toBeUndefined();
		expect(req.body).toBeInstanceOf(FormData);
		const file = (req.body as FormData).get('file') as File;
		expect(file.type).toBe('application/pdf');
		expect(file.name).toBe('doc.bin');
		expect(Buffer.from(await file.arrayBuffer()).toString()).toBe('%PDF-1.4');
		expect(out.json).toMatchObject({ id: 9 });
	});

	it('rejects a MIME type that does not match the format', async () => {
		const ctx = uploadCtx('image/png', { linkId: 9, format: 2 });
		await expect(archiveOperations.upload.call(ctx, 0, {})).rejects.toThrow(
			'is image/png, but the PDF format needs application/pdf',
		);
		expect(calls(ctx)).toHaveLength(0);
	});

	it('accepts image/jpg for JPEG and only images for previews', async () => {
		const jpeg = uploadCtx('image/jpg', { linkId: 9, format: 1 });
		await archiveOperations.upload.call(jpeg, 0, {});
		expect((calls(jpeg)[0].body as FormData).get('file')).toBeTruthy();

		const preview = uploadCtx('application/pdf', { linkId: 9, format: 2, preview: true });
		await expect(archiveOperations.upload.call(preview, 0, {})).rejects.toThrow('a preview needs');
	});

	it('uploads as a new link with the optional source URL', async () => {
		const ctx = uploadCtx('text/html', { format: 4, url: ' https://example.com/page ' });
		await archiveOperations.uploadNew.call(ctx, 0, {});
		const req = calls(ctx)[0];
		expect(req.url).toBe('https://links.example.com/api/v1/archives');
		expect(req.qs).toEqual({ format: 4 });
		expect((req.body as FormData).get('url')).toBe('https://example.com/page');
	});

	it('mentions the upload limit on 413', async () => {
		const ctx = mockContext([{ statusCode: 413, body: 'Request Entity Too Large' }], {
			linkId: 9,
			format: 2,
			binaryPropertyName: 'data',
		});
		ctx.helpers.assertBinaryData = vi.fn(() => ({ mimeType: 'application/pdf', data: '' }));
		ctx.helpers.getBinaryDataBuffer = vi.fn(async () => Buffer.from('x'));
		await expect(archiveOperations.upload.call(ctx, 0, {})).rejects.toMatchObject({
			description: expect.stringContaining('NEXT_PUBLIC_MAX_FILE_BUFFER'),
		});
	});
});
