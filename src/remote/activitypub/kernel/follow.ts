import { IFollow } from '../type';
import { ApServer } from '../../..';
import { RemoteUser, isLocalUser } from '../../../models';

export default async (server: ApServer, actor: RemoteUser, activity: IFollow): Promise<void> => {
	const follower = actor;

	const id = typeof activity.object == 'string' ? activity.object : activity.object.id;
	if (id == null) throw new Error('missing id');
	if (!id.startsWith(server.url + '/')) {
		return;
	}

	const userId = id.split('/').pop();
	if (userId == null) {
		return;
	}

	const followee = await server.getters.findUser(userId);

	if (followee == null) {
		throw new Error('followee not found');
	}

	if (!isLocalUser(followee)) {
		throw new Error('フォローしようとしているユーザーはローカルユーザーではありません');
	}

	await server.activityHandlers.follow(follower, followee, activity.id);
};
