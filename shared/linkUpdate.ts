import type { IDataObject } from 'n8n-workflow';

import type { Link, TagRef } from './types';

export type TagMode = 'replace' | 'add' | 'remove';

export interface LinkChanges {
	name?: string;
	url?: string;
	description?: string;
	color?: string;
	icon?: string;
	iconWeight?: string;
	/** Tag names, applied according to `tagMode`. */
	tags?: string[];
	tagMode?: TagMode;
	/** Target collection. Its owner id is required by the server. */
	collection?: { id: number; ownerId: number };
}

const key = (name: string) => name.trim().toLowerCase();

/** Applies a tag mode to the link's current tags. Names are compared case-insensitively. */
export function mergeTags(current: TagRef[], names: string[], mode: TagMode): TagRef[] {
	const existing = current.map((tag) => ({ id: tag.id, name: tag.name }));
	if (mode === 'remove') {
		const removed = new Set(names.map(key));
		return existing.filter((tag) => !removed.has(key(tag.name)));
	}
	const base = mode === 'replace' ? [] : existing;
	const seen = new Set(base.map((tag) => key(tag.name)));
	const result: TagRef[] = [...base];
	for (const name of names) {
		if (seen.has(key(name))) continue;
		seen.add(key(name));
		// Keep the id when replacing with a tag the link already has.
		const known = existing.find((tag) => key(tag.name) === key(name));
		result.push(known ?? { name: name.trim() });
	}
	return result;
}

function currentCollection(link: Link): { id: number; ownerId: number } {
	const id = link.collection?.id ?? link.collectionId;
	const ownerId = link.collection?.ownerId;
	if (typeof id !== 'number' || typeof ownerId !== 'number') {
		throw new Error(`Link ${link.id} has no collection information`);
	}
	return { id, ownerId };
}

/**
 * Builds a full `PUT /api/v1/links/{id}` body: the server replaces the link with the body
 * (tags included, and an absent name/description becomes ""), so every field starts from
 * the current link and only the requested changes are overlaid.
 */
export function buildLinkUpdateBody(current: Link, changes: LinkChanges = {}): IDataObject {
	const pick = <K extends keyof LinkChanges & keyof Link>(field: K) =>
		changes[field] !== undefined ? changes[field] : (current[field] ?? null);

	const body: IDataObject = {
		id: current.id,
		name: pick('name') ?? '',
		url: pick('url'),
		description: pick('description') ?? '',
		icon: pick('icon'),
		iconWeight: pick('iconWeight'),
		color: pick('color'),
		collection: changes.collection ?? currentCollection(current),
		tags: mergeTags(
			(current.tags ?? []) as TagRef[],
			changes.tags ?? [],
			changes.tags ? (changes.tagMode ?? 'add') : 'add',
		),
	};
	return body;
}

/**
 * Pin: `pinnedBy: [{ id: me }]`. Unpin: `[{}]` (the server disconnects the current user when
 * the first entry isn't them). Every other field is sent unchanged.
 */
export function buildPinBody(current: Link, userId: number, pin: boolean): IDataObject {
	return { ...buildLinkUpdateBody(current), pinnedBy: pin ? [{ id: userId }] : [{}] };
}
