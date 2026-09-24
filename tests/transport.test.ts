import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('n8n-workflow', async (importOriginal) => ({
	...(await importOriginal<typeof import('n8n-workflow')>()),
	sleep: vi.fn(async () => {}),
}));

import { sleep } from 'n8n-workflow';
import {
	errorText,
	linkwardenRequest,
	linkwardenRequestFull,
	retryDelayMs,
	unwrap,
} from '../shared/transport';
import { calls, mockContext } from './helpers';

beforeEach(() => vi.mocked(sleep).mockClear());

describe('unwrap', () => {
	it('handles { response }', () => {
		expect(unwrap({ response: { id: 1 } })).toEqual({ id: 1 });
	});
	it('handles the tags envelope', () => {
		const data = { tags: [{ id: 1 }], nextCursor: 5 };
		expect(unwrap({ success: true, message: 'ok', data })).toEqual(data);
	});
	it('handles the search envelope, including the empty-array variant', () => {
		expect(unwrap({ message: 'ok', data: { links: [], nextCursor: null } })).toEqual({
			links: [],
			nextCursor: null,
		});
		expect(unwrap({ message: 'Nothing found.', data: [] })).toEqual([]);
	});
	it('returns a bare object as-is', () => {
		expect(unwrap({ id: 3, name: 'x' })).toEqual({ id: 3, name: 'x' });
		expect(unwrap('text')).toBe('text');
	});
});

describe('errorText', () => {
	it('extracts server messages', () => {
		expect(errorText({ response: 'Link not found' })).toBe('Link not found');
		expect(errorText({ message: 'Bad' })).toBe('Bad');
		expect(errorText('plain')).toBe('plain');
		expect(errorText(undefined)).toBe('');
	});
});

describe('linkwardenRequest', () => {
	it('builds the URL from baseUrl without a double slash and sends the User-Agent', async () => {
		const ctx = mockContext([{ body: { response: { id: 1 } } }]);
		await expect(linkwardenRequest(ctx, 'GET', '/api/v1/users/me')).resolves.toEqual({ id: 1 });
		const [req] = calls(ctx);
		expect(req.url).toBe('https://links.example.com/api/v1/users/me');
		expect(req.headers['User-Agent']).toMatch(/^n8n-nodes-linkwarden\//);
		expect(req.ignoreHttpStatusErrors).toBe(true);
		expect(req.returnFullResponse).toBe(true);
		expect(req.json).toBe(true);
	});

	it('maps 400 to NodeApiError with the server text', async () => {
		const ctx = mockContext([{ statusCode: 400, body: { response: 'Invalid URL.' } }]);
		await expect(linkwardenRequest(ctx, 'POST', '/api/v1/links')).rejects.toMatchObject({
			message: 'Invalid URL.',
			httpCode: '400',
		});
	});

	it('shows a 401 permission message verbatim', async () => {
		const ctx = mockContext([
			{ statusCode: 401, body: { response: 'Collection is not accessible.' } },
		]);
		await expect(linkwardenRequest(ctx, 'PUT', '/api/v1/links/1')).rejects.toMatchObject({
			message: 'Collection is not accessible.',
		});
	});

	it('shows a credentials hint for a 401 token failure', async () => {
		const ctx = mockContext([{ statusCode: 401, body: { response: 'You must be logged in.' } }]);
		await expect(linkwardenRequest(ctx, 'GET', '/api/v1/users/me')).rejects.toMatchObject({
			message: expect.stringContaining('access token'),
		});
	});

	it('uses a per-status message override', async () => {
		const ctx = mockContext([{ statusCode: 404, body: { response: 'Link not found.' } }]);
		await expect(
			linkwardenRequest(ctx, 'GET', '/api/v1/links/123', {
				messages: { 404: 'Link 123 not found' },
			}),
		).rejects.toMatchObject({ message: 'Link 123 not found', httpCode: '404' });
	});

	it('maps 403 and 404 without retrying', async () => {
		for (const statusCode of [403, 404]) {
			const ctx = mockContext([{ statusCode, body: { response: 'Nope' } }]);
			await expect(linkwardenRequest(ctx, 'GET', '/x')).rejects.toMatchObject({ message: 'Nope' });
			expect(calls(ctx)).toHaveLength(1);
		}
	});

	it('returns allowed statuses instead of throwing', async () => {
		const ctx = mockContext([{ statusCode: 409, body: { response: 'Link already exists' } }]);
		await expect(
			linkwardenRequestFull(ctx, 'POST', '/api/v1/links', { allowStatuses: [409] }),
		).resolves.toMatchObject({ statusCode: 409, data: 'Link already exists' });
	});

	it('retries 429 and 5xx on GET, then succeeds', async () => {
		const ctx = mockContext([
			{ statusCode: 429, body: {} },
			{ statusCode: 500, body: {} },
			{ body: { response: 'ok' } },
		]);
		await expect(linkwardenRequest(ctx, 'GET', '/x')).resolves.toBe('ok');
		expect(calls(ctx)).toHaveLength(3);
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('gives up after maxRetries', async () => {
		const ctx = mockContext(Array(5).fill({ statusCode: 503, body: { response: 'down' } }));
		await expect(linkwardenRequest(ctx, 'GET', '/x', { maxRetries: 2 })).rejects.toMatchObject({
			httpCode: '503',
		});
		expect(calls(ctx)).toHaveLength(3);
	});

	it('retries network errors on GET', async () => {
		const ctx = mockContext([{ throws: new Error('ETIMEDOUT') }, { body: { response: 1 } }]);
		await expect(linkwardenRequest(ctx, 'GET', '/x')).resolves.toBe(1);
	});

	it('never retries a POST on a timeout', async () => {
		const ctx = mockContext([{ throws: new Error('timeout of 300000ms exceeded') }, { body: {} }]);
		await expect(linkwardenRequest(ctx, 'POST', '/api/v1/links')).rejects.toMatchObject({
			message: expect.stringContaining('Could not reach Linkwarden'),
		});
		expect(calls(ctx)).toHaveLength(1);
	});

	it('retries a POST on 429 and 503 but not on 500', async () => {
		const ok = mockContext([
			{ statusCode: 429, body: {} },
			{ statusCode: 503, body: {} },
			{ body: { response: 'ok' } },
		]);
		await expect(linkwardenRequest(ok, 'POST', '/x')).resolves.toBe('ok');
		const fail = mockContext([{ statusCode: 500, body: { response: 'boom' } }, { body: {} }]);
		await expect(linkwardenRequest(fail, 'POST', '/x')).rejects.toMatchObject({ httpCode: '500' });
		expect(calls(fail)).toHaveLength(1);
	});

	it('honors Retry-After (capped at 60 s)', async () => {
		const ctx = mockContext([
			{ statusCode: 429, headers: { 'retry-after': '7' }, body: {} },
			{ body: { response: 1 } },
		]);
		await linkwardenRequest(ctx, 'GET', '/x');
		expect(vi.mocked(sleep).mock.calls[0][0]).toBe(7000);
		expect(retryDelayMs(0, '3600')).toBe(60_000);
	});

	it('caps exponential backoff at 10 s', () => {
		expect(retryDelayMs(0)).toBeGreaterThanOrEqual(500);
		expect(retryDelayMs(0)).toBeLessThan(750);
		expect(retryDelayMs(10)).toBe(10_000);
	});

	it('does not leak the token or headers in error messages', async () => {
		const ctx = mockContext([
			{
				throws: Object.assign(new Error('socket hang up'), {
					config: { headers: { Authorization: 'Bearer secret-token' } },
				}),
			},
		]);
		const error = await linkwardenRequest(ctx, 'POST', '/x').catch((e) => e);
		expect(JSON.stringify(error)).not.toContain('secret-token');
		expect(String(error.message)).not.toContain('secret-token');
	});

	it('returns a Buffer in binary mode and decodes JSON errors', async () => {
		const ctx = mockContext([
			{ body: Buffer.from('PNGDATA') },
			{ statusCode: 404, body: Buffer.from(JSON.stringify({ response: 'Archive not found' })) },
		]);
		const res = await linkwardenRequestFull<Buffer>(ctx, 'GET', '/a', { binary: true });
		expect(Buffer.isBuffer(res.data)).toBe(true);
		expect(res.data.toString()).toBe('PNGDATA');
		expect(calls(ctx)[0].encoding).toBe('arraybuffer');
		await expect(linkwardenRequest(ctx, 'GET', '/a', { binary: true })).rejects.toMatchObject({
			message: 'Archive not found',
		});
	});
});
