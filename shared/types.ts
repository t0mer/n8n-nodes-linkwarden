import type { IDataObject } from 'n8n-workflow';

export interface TagRef extends IDataObject {
	id?: number;
	name: string;
}

export interface Tag extends IDataObject {
	id: number;
	name: string;
	ownerId?: number;
	createdAt?: string;
	updatedAt?: string;
	_count?: { links: number };
}

export interface CollectionMember extends IDataObject {
	userId: number;
	collectionId?: number;
	canCreate: boolean;
	canUpdate: boolean;
	canDelete: boolean;
}

export interface Collection extends IDataObject {
	id: number;
	name: string;
	description?: string | null;
	color?: string | null;
	icon?: string | null;
	iconWeight?: string | null;
	isPublic?: boolean;
	ownerId: number;
	parentId?: number | null;
	parent?: { id: number; name: string } | null;
	members?: CollectionMember[];
	_count?: { links: number };
	createdAt?: string;
	updatedAt?: string;
}

export interface Link extends IDataObject {
	id: number;
	name?: string | null;
	type?: string;
	url?: string | null;
	description?: string | null;
	icon?: string | null;
	iconWeight?: string | null;
	color?: string | null;
	collectionId?: number;
	collection?: { id: number; ownerId: number; name?: string } & IDataObject;
	tags?: Tag[];
	pinnedBy?: Array<{ id?: number }>;
	image?: string | null;
	pdf?: string | null;
	readable?: string | null;
	monolith?: string | null;
	preview?: string | null;
	createdAt?: string;
	updatedAt?: string;
	lastPreserved?: string | null;
}

export interface Highlight extends IDataObject {
	id: number;
	linkId: number;
	color: string;
	text: string;
	startOffset: number;
	endOffset: number;
	comment?: string | null;
}

export interface RssSubscription extends IDataObject {
	id: number;
	name: string;
	url: string;
	collectionId: number;
}

export interface User extends IDataObject {
	id: number;
	username?: string | null;
	name?: string | null;
	email?: string | null;
	locale?: string | null;
}
