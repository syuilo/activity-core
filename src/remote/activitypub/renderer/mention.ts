import config from '../../../config';
import { User, LocalUser } from '../../../models/entities/user';
import { Users } from '../../../models';

export default (mention: User) => ({
	type: 'Mention',
	href: Users.isRemoteUser(mention) ? mention.uri : `${config.url}/@${(mention as LocalUser).username}`,
	name: Users.isRemoteUser(mention) ? `@${mention.username}@${mention.host}` : `@${(mention as LocalUser).username}`,
});
