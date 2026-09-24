import { PACKAGE_VERSION } from './version';

export const CREDENTIAL_NAME = 'linkwardenApi';

export const USER_AGENT = `n8n-nodes-linkwarden/${PACKAGE_VERSION}`;

/** Hard stop for any paginated read, whatever `returnAll` says. */
export const MAX_ITEMS = 10_000;

/** Default page size used by Linkwarden (`PAGINATION_TAKE_COUNT`). */
export const DEFAULT_PAGE_SIZE = 50;

export const DEFAULT_LIMIT = 50;

export const BULK_UPDATE_CAP = 500;

export const FIND_BY_URL_MAX_PAGES = 5;

export const DEFAULT_MAX_RETRIES = 3;
export const RETRY_BASE_MS = 500;
export const RETRY_JITTER_MS = 250;
export const RETRY_CAP_MS = 10_000;
export const RETRY_AFTER_CAP_MS = 60_000;

/** `sort` values of `GET /api/v1/links` and `GET /api/v1/search`. */
export const LinkSort = {
	NewestFirst: 0,
	OldestFirst: 1,
	NameAsc: 2,
	NameDesc: 3,
} as const;

/** `sort` values of `GET /api/v1/tags`. */
export const TagSort = {
	NewestFirst: 0,
	OldestFirst: 1,
	NameAsc: 2,
	NameDesc: 3,
	MostLinks: 4,
	FewestLinks: 5,
} as const;

export interface ArchiveFormatInfo {
	label: string;
	extension: string;
	mimeType: string;
	/** MIME types the server accepts for an upload in this format. Empty = not uploadable. */
	uploadMimeTypes: string[];
}

/** `format` values of `/api/v1/archives`. */
export const ARCHIVE_FORMATS: Record<number, ArchiveFormatInfo> = {
	0: {
		label: 'Screenshot (PNG)',
		extension: 'png',
		mimeType: 'image/png',
		uploadMimeTypes: ['image/png'],
	},
	1: {
		label: 'Screenshot (JPEG)',
		extension: 'jpeg',
		mimeType: 'image/jpeg',
		uploadMimeTypes: ['image/jpeg', 'image/jpg'],
	},
	2: {
		label: 'PDF',
		extension: 'pdf',
		mimeType: 'application/pdf',
		uploadMimeTypes: ['application/pdf'],
	},
	3: {
		label: 'Readable (JSON)',
		extension: 'json',
		mimeType: 'application/json',
		uploadMimeTypes: [],
	},
	4: {
		label: 'Single-File HTML',
		extension: 'html',
		mimeType: 'text/html',
		uploadMimeTypes: ['text/html'],
	},
};

export const HIGHLIGHT_COLORS = ['blue', 'green', 'red', 'yellow'] as const;
