import { simplifyUser } from '../../../shared/simplify';
import { linkwardenRequest } from '../../../shared/transport';
import type { User } from '../../../shared/types';
import { requestOptions, toItems, type OperationHandler } from './utils';

const getMe: OperationHandler = async function (i) {
	const simplify = this.getNodeParameter('simplify', i, true) as boolean;
	const user = await linkwardenRequest<User>(
		this,
		'GET',
		'/api/v1/users/me',
		requestOptions(this, i),
	);
	return toItems(simplify ? simplifyUser(user) : user);
};

export const userOperations: Record<string, OperationHandler> = { getMe };
