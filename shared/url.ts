const URL_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^#]*)/i;

interface UrlParts {
	scheme: string;
	host: string;
	/** Path and query, trailing slashes removed from the path. */
	rest: string;
}

function parts(input: string): UrlParts {
	const trimmed = input.trim();
	const match = URL_PATTERN.exec(trimmed);
	let scheme = '';
	let host: string;
	let rest: string;
	if (match) {
		scheme = match[1].toLowerCase();
		host = match[2];
		rest = match[3];
	} else {
		// No scheme ("example.com/page"): the host runs up to the first "/", "?" or "#".
		const withoutFragment = trimmed.split('#')[0];
		const cut = withoutFragment.search(/[/?]/);
		host = cut === -1 ? withoutFragment : withoutFragment.slice(0, cut);
		rest = cut === -1 ? '' : withoutFragment.slice(cut);
	}

	host = host.toLowerCase().replace(/^www\./, '');

	const queryStart = rest.indexOf('?');
	const path = queryStart === -1 ? rest : rest.slice(0, queryStart);
	const query = queryStart === -1 ? '' : rest.slice(queryStart);
	return { scheme, host, rest: path.replace(/\/+$/, '') + query };
}

/**
 * Normalizes a URL for duplicate detection: trims, lowercases scheme and host,
 * drops `www.`, trailing slashes and the fragment. Path and query stay as-is.
 * IDN hosts are left in their original (Unicode) form.
 */
export function normalizeUrl(input: string): string {
	const { scheme, host, rest } = parts(input);
	return `${scheme ? `${scheme}://` : ''}${host}${rest}`;
}

/** Text used to search Linkwarden for a URL: host + path, without scheme, `www.` or query. */
export function urlSearchTerm(input: string): string {
	const { host, rest } = parts(input);
	const queryStart = rest.indexOf('?');
	return host + (queryStart === -1 ? rest : rest.slice(0, queryStart));
}

/** Whether two URLs are the same after normalization. */
export function sameUrl(a: string | null | undefined, b: string): boolean {
	return !!a && normalizeUrl(a) === normalizeUrl(b);
}
