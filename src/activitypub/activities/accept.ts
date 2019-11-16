import { ApServer } from '../..';
import { RemoteUser } from '../../models';
import { IAccept, IFollow } from '../type';
import Resolver from '../resolver';

const logger = apLogger;

export default async (server: ApServer, actor: RemoteUser, activity: IAccept): Promise<void> => {
	const uri = activity.id || activity;

	logger.info(`Accept: ${uri}`);

	const resolver = new Resolver(server);

	let object;

	try {
		object = await resolver.resolve(activity.object);
	} catch (e) {
		logger.error(`Resolution failed: ${e}`);
		throw e;
	}

	switch (object.type) {
	case 'Follow':
		acceptFollow(server, actor, object as IFollow);
		break;

	default:
		logger.warn(`Unknown accept type: ${object.type}`);
		break;
	}
};

async function acceptFollow(server: ApServer, actor: RemoteUser, activity: IFollow): Promise<void> {
	const id = typeof activity.actor == 'string' ? activity.actor : activity.actor.id;
	if (id == null) throw new Error('missing id');

	if (!id.startsWith(server.url + '/')) {
		return;
	}

	const userId = id.split('/').pop();

	if (userId == null) {
		return;
	}

	const follower = await server.getters.findUser(userId);

	if (follower == null) {
		throw new Error('follower not found');
	}

	if (follower.host != null) {
		throw new Error('フォローリクエストしたユーザーはローカルユーザーではありません');
	}

	await server.activityHandlers.acceptFollow(actor, follower);
}
