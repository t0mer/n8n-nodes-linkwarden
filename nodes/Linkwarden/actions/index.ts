import { archiveOperations } from './archive';
import { collectionOperations } from './collection';
import { highlightOperations } from './highlight';
import { linkOperations } from './link';
import { rssOperations } from './rss';
import { tagOperations } from './tag';
import type { OperationHandler } from './utils';

export const handlers: Record<string, Record<string, OperationHandler>> = {
	archive: archiveOperations,
	collection: collectionOperations,
	highlight: highlightOperations,
	link: linkOperations,
	rssSubscription: rssOperations,
	tag: tagOperations,
};

/** Operations that can read their input from the first item only and run a single request. */
export const RUN_ONCE_OPERATIONS = new Set<string>([
	'link.bulkUpdate',
	'link.deleteArchives',
	'link.deleteMany',
	'tag.create',
	'tag.deleteMany',
]);
