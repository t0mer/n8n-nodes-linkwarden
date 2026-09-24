import { describe, expect, it } from 'vitest';

import { userOperations } from '../nodes/Linkwarden/actions/user';
import { mockContext } from './helpers';

const me = {
	id: 1,
	username: 'tester',
	name: 'Tester',
	email: null,
	locale: 'en',
	subscription: { active: true },
	parentSubscription: null,
	dashboardSections: [{ type: 'PINNED_LINKS' }],
};

describe('User Get Me', () => {
	it('simplifies by default', async () => {
		const ctx = mockContext([{ body: { response: me } }]);
		const [out] = await userOperations.getMe.call(ctx, 0, {});
		expect(out.json).toEqual({
			id: 1,
			username: 'tester',
			name: 'Tester',
			email: null,
			locale: 'en',
		});
	});

	it('returns the raw user when simplify is off', async () => {
		const ctx = mockContext([{ body: { response: me } }], { simplify: false });
		const [out] = await userOperations.getMe.call(ctx, 0, {});
		expect(out.json).toEqual(me);
	});
});
