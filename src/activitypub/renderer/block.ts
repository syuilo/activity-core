import config from '../../../config';
import { LocalUser, RemoteUser } from '../../../models/entities/user';

export default (blocker: LocalUser, blockee: RemoteUser) => ({
	type: 'Block',
	actor: `${server.url}/users/${blocker.id}`,
	object: blockee.uri
});
