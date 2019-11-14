import { IFollow } from '../type';
import { ApServer } from '../../..';
import { RemoteUser, isLocalUser } from '../../../models';
import { renderActivity } from '../renderer';

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

	const result = await server.activityHandlers.follow(follower, followee);

	if (result === 'success') {
		const content = renderActivity(renderAccept(renderFollow(follower, followee, activity.id), followee));
		server.queue.deliver(followee, content, follower.inbox);	
	} else if (result === 'blocked') {
		// TODO
	}
};
