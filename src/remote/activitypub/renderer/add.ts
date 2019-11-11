import config from '../../../config';
import { LocalUser } from '../../../models/entities/user';

export default (user: LocalUser, target: any, object: any) => ({
	type: 'Add',
	actor: `${config.url}/users/${user.id}`,
	target,
	object
});
