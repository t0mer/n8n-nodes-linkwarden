import {
	NodeApiError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type IN8nHttpFullResponse,
	type IPollFunctions,
	type JsonObject,
	type RequestHelperFunctions,
} from 'n8n-workflow';

import {
	CREDENTIAL_NAME,
	DEFAULT_MAX_RETRIES,
	RETRY_AFTER_CAP_MS,
	RETRY_BASE_MS,
	RETRY_CAP_MS,
	RETRY_JITTER_MS,
	USER_AGENT,
} from './constants';

export type LinkwardenContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export interface LinkwardenRequestOptions {
	qs?: IDataObject;
	body?: IDataObject | IDataObject[] | FormData;
	/** Return the raw body as a Buffer (archive downloads). */
	binary?: boolean;
	/** Statuses returned to the caller instead of thrown (e.g. 404 for Find by URL, 409 on Create). */
	allowStatuses?: number[];
	/** Per-status error message override; the server text becomes the description. */
	messages?: Partial<Record<number, string>>;
	itemIndex?: number;
	maxRetries?: number;
}

export interface LinkwardenResponse<T = unknown> {
	statusCode: number;
	headers: IDataObject;
	/** Unwrapped data (see `unwrap`), or a Buffer when `binary` is set. */
	data: T;
}

/**
 * Linkwarden wraps payloads in `{ response }` (most routes) or `{ data }` (tags, search).
 * Some routes return the bare object. Returns the payload in all cases.
 */
export function unwrap<T = unknown>(body: unknown): T {
	if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
		const obj = body as IDataObject;
		if ('response' in obj) return obj.response as T;
		if ('data' in obj) return obj.data as T;
	}
	return body as T;
}

/** Extracts the human-readable text from an error body (`{ response: "…" }` and friends). */
export function errorText(body: unknown): string {
	if (typeof body === 'string') return body;
	if (body !== null && typeof body === 'object') {
		const obj = body as IDataObject;
		for (const key of ['response', 'message', 'error']) {
			if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string;
		}
	}
	return '';
}

// Messages Linkwarden sends for a missing, invalid or expired token.
const AUTH_FAILURE_PATTERN = /logged in|unauthori[sz]ed|token|session|authenticat/i;

export function isRetryableStatus(method: IHttpRequestMethods, status: number): boolean {
	if (status === 429) return true;
	// A POST may already have been applied on a generic 5xx; only retry gateway/unavailable errors.
	if (method === 'POST') return status === 502 || status === 503 || status === 504;
	return status >= 500 && status <= 599;
}

export function retryDelayMs(attempt: number, retryAfter?: unknown): number {
	const header = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
	if (header !== undefined && header !== null && header !== '') {
		const seconds = Number(header);
		let ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(String(header)) - Date.now();
		if (Number.isFinite(ms)) {
			ms = Math.max(0, ms);
			return Math.min(ms, RETRY_AFTER_CAP_MS);
		}
	}
	const backoff = RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * RETRY_JITTER_MS);
	return Math.min(backoff, RETRY_CAP_MS);
}

function decodeBody(body: unknown): unknown {
	if (!Buffer.isBuffer(body) && !(body instanceof ArrayBuffer)) return body;
	const text = Buffer.from(body as ArrayBuffer).toString('utf8');
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

function toBuffer(body: unknown): Buffer {
	if (Buffer.isBuffer(body)) return body;
	if (body instanceof ArrayBuffer) return Buffer.from(body);
	if (typeof body === 'string') return Buffer.from(body);
	return Buffer.from(JSON.stringify(body ?? ''));
}

function statusError(
	ctx: LinkwardenContext,
	statusCode: number,
	rawBody: unknown,
	options: LinkwardenRequestOptions,
): NodeApiError {
	const body = decodeBody(rawBody);
	const text = errorText(body);
	let message = options.messages?.[statusCode];
	let description = message ? text || undefined : undefined;

	if (!message) {
		switch (true) {
			case statusCode === 401 && text !== '' && !AUTH_FAILURE_PATTERN.test(text):
				// Linkwarden also uses 401 for permission denials ("Collection is not accessible.").
				message = text;
				break;
			case statusCode === 401:
				message = 'Authorization failed: check your Linkwarden access token';
				description = text || undefined;
				break;
			case statusCode === 429:
				message = 'Linkwarden rate limit reached, try again later';
				description = text || undefined;
				break;
			default:
				message = text || `Linkwarden returned HTTP ${statusCode}`;
		}
	}

	const errorResponse: JsonObject =
		body !== null && typeof body === 'object' && !Array.isArray(body)
			? (body as JsonObject)
			: { response: text };

	return new NodeApiError(ctx.getNode(), errorResponse, {
		message,
		description,
		httpCode: String(statusCode),
		itemIndex: options.itemIndex,
	});
}

function abortSignalOf(ctx: LinkwardenContext): AbortSignal | undefined {
	const fn = (ctx as Partial<IExecuteFunctions>).getExecutionCancelSignal;
	return typeof fn === 'function' ? fn.call(ctx) : undefined;
}

/**
 * Sends one request to Linkwarden with retries on 429 / 5xx / network errors,
 * and maps non-2xx statuses to `NodeApiError`. Never retries a POST on a timeout
 * or network error (a Create could double-save).
 */
export async function linkwardenRequestFull<T = unknown>(
	ctx: LinkwardenContext,
	method: IHttpRequestMethods,
	path: string,
	options: LinkwardenRequestOptions = {},
): Promise<LinkwardenResponse<T>> {
	const credentials = await ctx.getCredentials(CREDENTIAL_NAME);
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');
	const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

	const request: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		headers: { 'User-Agent': USER_AGENT, Accept: options.binary ? '*/*' : 'application/json' },
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (options.qs && Object.keys(options.qs).length > 0) request.qs = options.qs;
	if (options.body !== undefined) request.body = options.body as IHttpRequestOptions['body'];
	if (options.binary) request.encoding = 'arraybuffer';
	else if (!isForm) request.json = true;

	const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
	const signal = abortSignalOf(ctx);
	const httpRequestWithAuthentication = ctx.helpers
		.httpRequestWithAuthentication as RequestHelperFunctions['httpRequestWithAuthentication'];

	for (let attempt = 0; ; attempt++) {
		let response: IN8nHttpFullResponse;
		try {
			response = (await httpRequestWithAuthentication.call(
				ctx,
				CREDENTIAL_NAME,
				request,
			)) as IN8nHttpFullResponse;
		} catch (error) {
			// Network error or timeout: build a fresh error so request config (headers) never leaks.
			const reason = (error as Error)?.message ?? String(error);
			if (method !== 'POST' && attempt < maxRetries) {
				await sleep(retryDelayMs(attempt), signal);
				continue;
			}
			throw new NodeApiError(
				ctx.getNode(),
				{ message: reason },
				{
					message: `Could not reach Linkwarden: ${reason}`,
					itemIndex: options.itemIndex,
				},
			);
		}

		const { statusCode } = response;
		if (statusCode >= 200 && statusCode < 300) {
			return {
				statusCode,
				headers: response.headers ?? {},
				data: (options.binary ? toBuffer(response.body) : unwrap(response.body)) as T,
			};
		}
		if (options.allowStatuses?.includes(statusCode)) {
			return {
				statusCode,
				headers: response.headers ?? {},
				data: unwrap(decodeBody(response.body)) as T,
			};
		}
		if (isRetryableStatus(method, statusCode) && attempt < maxRetries) {
			await sleep(retryDelayMs(attempt, response.headers?.['retry-after']), signal);
			continue;
		}
		throw statusError(ctx, statusCode, response.body, options);
	}
}

export async function linkwardenRequest<T = unknown>(
	ctx: LinkwardenContext,
	method: IHttpRequestMethods,
	path: string,
	options: LinkwardenRequestOptions = {},
): Promise<T> {
	return (await linkwardenRequestFull<T>(ctx, method, path, options)).data;
}
