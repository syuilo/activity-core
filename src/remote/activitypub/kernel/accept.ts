import Resolver from '../../resolver';
import { RemoteUser } from '../../../../models/entities/user';
import { IAccept, IFollow } from '../../type';
import { apLogger } from '../../logger';
import accept from '../../../../services/following/requests/accept';

const logger = apLogger;

export default async (actor: RemoteUser, activity: IAccept): Promise<void> => {
	const uri = activity.id || activity;

	logger.info(`Accept: ${uri}`);

	const resolver = new Resolver();

	let object;

	try {
		object = await resolver.resolve(activity.object);
	} catch (e) {
		logger.error(`Resolution failed: ${e}`);
		throw e;
	}

	switch (object.type) {
	case 'Follow':
		acceptFollow(actor, object as IFollow);
		break;

	default:
		logger.warn(`Unknown accept type: ${object.type}`);
		break;
	}
};

async function acceptFollow(actor: RemoteUser, activity: IFollow): Promise<void> {
	const id = typeof activity.actor == 'string' ? activity.actor : activity.actor.id;
	if (id == null) throw new Error('missing id');

	if (!id.startsWith(config.url + '/')) {
		return;
	}

	const follower = await Users.findOne({
		id: id.split('/').pop()
	});

	if (follower == null) {
		throw new Error('follower not found');
	}

	if (follower.host != null) {
		throw new Error('フォローリクエストしたユーザーはローカルユーザーではありません');
	}

	await accept(actor, follower);
}
