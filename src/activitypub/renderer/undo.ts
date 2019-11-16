import config from '../../../config';
import { LocalUser, User } from '../../../models/entities/user';

export default (object: any, user: LocalUser | User) => ({
	type: 'Undo',
	actor: `${server.url}/users/${user.id}`,
	object
});
