import type { IDataObject } from 'n8n-workflow';

import type { User } from './types';

export function simplifyUser(user: User): IDataObject {
	return {
		id: user.id,
		username: user.username ?? null,
		name: user.name ?? null,
		email: user.email ?? null,
		locale: user.locale ?? null,
	};
}
