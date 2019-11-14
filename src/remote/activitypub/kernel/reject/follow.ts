import { ApServer } from '../../../..';
import { RemoteUser } from '../../../../models';
import { IFollow } from '../../type';

export default async (server: ApServer, actor: RemoteUser, activity: IFollow): Promise<void> => {
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

	await server.activityHandlers.rejectFollow(actor, follower);
};
