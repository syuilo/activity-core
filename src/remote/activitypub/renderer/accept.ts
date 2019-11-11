import config from '../../../config';
import { LocalUser } from '../../../models/entities/user';

export default (object: any, user: LocalUser) => ({
	type: 'Accept',
	actor: `${config.url}/users/${user.id}`,
	object
});
