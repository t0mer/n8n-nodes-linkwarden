import { vi } from 'vitest';

export interface MockResponse {
	statusCode?: number;
	body?: unknown;
	headers?: Record<string, unknown>;
	/** Throw this instead of returning a response (network error). */
	throws?: Error;
}

export type Responder = (options: {
	method: string;
	url: string;
	qs?: Record<string, unknown>;
	body?: unknown;
}) => MockResponse;

/** Mock n8n context whose HTTP helper answers from a queue or a routing function. */
export function mockContext(
	responses: MockResponse[] | Responder,
	params: Record<string, unknown> = {},
	extra: Record<string, unknown> = {},
) {
	const queue = Array.isArray(responses) ? [...responses] : undefined;
	const httpRequestWithAuthentication = vi.fn(async (_cred: string, options: never) => {
		const next = queue ? queue.shift() : (responses as Responder)(options);
		if (!next) throw new Error('No mock response left');
		if (next.throws) throw next.throws;
		return { statusCode: next.statusCode ?? 200, body: next.body, headers: next.headers ?? {} };
	});
	const node = { name: 'Linkwarden', type: 'CUSTOM.linkwarden', typeVersion: 1, parameters: {} };
	return {
		getCredentials: vi.fn(async () => ({
			baseUrl: 'https://links.example.com/',
			accessToken: 'secret-token',
		})),
		getNode: vi.fn(() => node),
		getNodeParameter: vi.fn((name: string, _i?: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		),
		helpers: { httpRequestWithAuthentication },
		...extra,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

/** Calls made to the HTTP helper: [{ method, url, qs, body }]. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calls(ctx: any): Array<Record<string, any>> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ctx.helpers.httpRequestWithAuthentication.mock.calls.map((c: any[]) => c[1]);
}
