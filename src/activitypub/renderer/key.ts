import config from '../../../config';
import { LocalUser } from '../../../models/entities/user';
import { UserKeypair } from '../../../models/entities/user-keypair';

export default (user: LocalUser, key: UserKeypair) => ({
	id: `${server.url}/users/${user.id}/publickey`,
	type: 'Key',
	owner: `${server.url}/users/${user.id}`,
	publicKeyPem: key.publicKey
});
