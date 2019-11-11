import config from '../../../config';
import { LocalUser } from '../../../models/entities/user';
import { UserKeypair } from '../../../models/entities/user-keypair';

export default (user: LocalUser, key: UserKeypair) => ({
	id: `${config.url}/users/${user.id}/publickey`,
	type: 'Key',
	owner: `${config.url}/users/${user.id}`,
	publicKeyPem: key.publicKey
});
