import type { IDataObject } from 'n8n-workflow';

import type { Link, User } from './types';

export function simplifyUser(user: User): IDataObject {
	return {
		id: user.id,
		username: user.username ?? null,
		name: user.name ?? null,
		email: user.email ?? null,
		locale: user.locale ?? null,
	};
}

const hasArchive = (value: unknown) =>
	typeof value === 'string' && value !== '' && value !== 'unavailable';

/** Compact link shape used when "Simplify" is on. */
export function simplifyLink(link: Link): IDataObject {
	return {
		id: link.id,
		name: link.name ?? null,
		url: link.url ?? null,
		description: link.description ?? null,
		type: link.type ?? null,
		collectionId: link.collection?.id ?? link.collectionId ?? null,
		collectionName: link.collection?.name ?? null,
		tags: (link.tags ?? []).map((tag) => tag.name),
		pinned: (link.pinnedBy ?? []).length > 0,
		createdAt: link.createdAt ?? null,
		updatedAt: link.updatedAt ?? null,
		preservedAt: link.lastPreserved ?? null,
		archives: {
			screenshot: hasArchive(link.image),
			pdf: hasArchive(link.pdf),
			readable: hasArchive(link.readable),
			monolith: hasArchive(link.monolith),
		},
	};
}
