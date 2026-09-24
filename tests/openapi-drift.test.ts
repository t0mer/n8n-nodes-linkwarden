import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import specText from './fixtures/linkwarden.openapi.yaml?raw';

const spec = parse(specText) as { paths: Record<string, Record<string, unknown>> };

/** Endpoints the node uses (CLAUDE.md §4.3), as documented in the spec. */
const USED: Array<[string, string]> = [
	['get', '/api/v1/users/me'],
	['get', '/api/v1/links'],
	['post', '/api/v1/links'],
	['put', '/api/v1/links'],
	['delete', '/api/v1/links'],
	['get', '/api/v1/links/{id}'],
	['put', '/api/v1/links/{id}'],
	['delete', '/api/v1/links/{id}'],
	['put', '/api/v1/links/{id}/archive'],
	['delete', '/api/v1/links/archive'],
	['get', '/api/v1/links/{id}/highlights'],
	['get', '/api/v1/search'],
	['post', '/api/v1/highlights'],
	['delete', '/api/v1/highlights/{id}'],
	['get', '/api/v1/collections'],
	['get', '/api/v1/collections/{id}'],
	['put', '/api/v1/collections/{id}'],
	['delete', '/api/v1/collections/{id}'],
	['get', '/api/v1/tags'],
	['post', '/api/v1/tags'],
	['delete', '/api/v1/tags'],
	['get', '/api/v1/tags/{id}'],
	['put', '/api/v1/tags/{id}'],
	['delete', '/api/v1/tags/{id}'],
	['get', '/api/v1/archives/{linkId}'],
	['post', '/api/v1/archives/{linkId}'],
	['post', '/api/v1/archives'],
	['get', '/api/v1/rss'],
	['post', '/api/v1/rss'],
	['delete', '/api/v1/rss/{id}'],
];

describe('Linkwarden OpenAPI drift', () => {
	it.each(USED)('%s %s is still documented', (method, path) => {
		expect(spec.paths[path], `path ${path}`).toBeDefined();
		expect(spec.paths[path][method], `${method} ${path}`).toBeDefined();
	});

	it('still documents collection create at the wrong path (the node uses POST /collections)', () => {
		// When this fails, the spec was fixed: update CLAUDE.md §4.3 and README "Known quirks".
		expect(spec.paths['/api/v1/collections/{id}'].post).toBeDefined();
		expect(spec.paths['/api/v1/collections'].post).toBeUndefined();
	});
});
