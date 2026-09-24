import { describe, expect, it } from 'vitest';

import { normalizeUrl, sameUrl, urlSearchTerm } from '../shared/url';

describe('normalizeUrl', () => {
	it.each([
		['https://www.Example.com/', 'https://example.com'],
		['  HTTPS://EXAMPLE.com/Path/  ', 'https://example.com/Path'],
		['https://example.com/a///', 'https://example.com/a'],
		['https://example.com/a#section', 'https://example.com/a'],
		['https://example.com/a/?q=1&B=2', 'https://example.com/a?q=1&B=2'],
		['https://example.com/a?q=1#frag', 'https://example.com/a?q=1'],
		['http://example.com', 'http://example.com'],
		['https://bücher.de/über', 'https://bücher.de/über'],
		['https://xn--bcher-kva.de/', 'https://xn--bcher-kva.de'],
		['https://user@Example.com:8080/x', 'https://user@example.com:8080/x'],
		['www.example.com/x/', 'example.com/x'],
	])('%s -> %s', (input, expected) => {
		expect(normalizeUrl(input)).toBe(expected);
	});

	it('keeps http and https distinct, like the server', () => {
		expect(sameUrl('http://example.com', 'https://example.com')).toBe(false);
	});

	it('matches www and trailing slash variants', () => {
		expect(sameUrl('https://www.example.com/a/', 'https://example.com/a')).toBe(true);
		expect(sameUrl(null, 'https://example.com')).toBe(false);
	});
});

describe('urlSearchTerm', () => {
	it('uses host + path', () => {
		expect(urlSearchTerm('https://www.example.com/blog/post/?utm=1#x')).toBe(
			'example.com/blog/post',
		);
		expect(urlSearchTerm('https://example.com/')).toBe('example.com');
	});
});
