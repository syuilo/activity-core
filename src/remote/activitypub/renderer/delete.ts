import config from '../../../config';
import { LocalUser } from '../../../models/entities/user';

export default (object: any, user: LocalUser) => ({
	type: 'Delete',
	actor: `${server.url}/users/${user.id}`,
	object
});
