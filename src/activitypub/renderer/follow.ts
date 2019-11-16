import config from '../../../config';
import { User } from '../../../models/entities/user';
import { Users } from '../../models';

export default (follower: User, followee: User, requestId?: string) => {
	const follow = {
		type: 'Follow',
		actor: isLocalUser(follower) ? `${server.url}/users/${follower.id}` : follower.uri,
		object: isLocalUser(followee) ? `${server.url}/users/${followee.id}` : followee.uri
	} as any;

	if (requestId) follow.id = requestId;

	return follow;
};
