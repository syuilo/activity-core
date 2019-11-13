import config from '../../../config';
import { User, LocalUser } from '../../../models/entities/user';
import { Users } from '../../../models';

export default (mention: User) => ({
	type: 'Mention',
	href: isRemoteUser(mention) ? mention.uri : `${server.url}/@${(mention as LocalUser).username}`,
	name: isRemoteUser(mention) ? `@${mention.username}@${mention.host}` : `@${(mention as LocalUser).username}`,
});
