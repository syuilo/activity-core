import { IFollow } from '../type';
import { ApServer } from '../../..';
import { RemoteUser, isRemoteUser, isLocalUser } from '../../../models';
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

	const followee = await server.db.users.findOne(userId);

	if (followee == null) {
		throw new Error('followee not found');
	}

	if (followee.host != null) {
		throw new Error('フォローしようとしているユーザーはローカルユーザーではありません');
	}

	// check blocking
	const [blocking, blocked] = await Promise.all([
		server.db.blockings.findOne({
			blockerId: follower.id,
			blockeeId: followee.id,
		}),
		server.db.blockings.findOne({
			blockerId: followee.id,
			blockeeId: follower.id,
		})
	]);

	if (isRemoteUser(follower) && isLocalUser(followee) && blocked) {
		// リモートフォローを受けてブロックしていた場合は、エラーにするのではなくRejectを送り返しておしまい。
		const content = renderActivity(renderReject(renderFollow(follower, followee, activity.id), followee));
		deliver(followee , content, follower.inbox);
		return;
	} else if (isRemoteUser(follower) && isLocalUser(followee) && blocking) {
		// リモートフォローを受けてブロックされているはずの場合だったら、ブロック解除しておく。
		await server.unblock(follower, followee);
	} else {
		// それ以外は単純に例外
		if (blocking != null) throw new ApError('710e8fb0-b8c3-4922-be49-d5d93d8e6a6e', 'blocking');
		if (blocked != null) throw new ApError('3338392a-f764-498d-8855-db939dcf8c48', 'blocked');
	}
	
	// フォロー対象が鍵アカウントである or
	// フォロワーがローカルユーザーであり、フォロー対象がリモートユーザーである
	// 上記のいずれかに当てはまる場合はすぐフォローせずにフォローリクエストを発行しておく
	if (followee.isLocked || (isLocalUser(follower) && isRemoteUser(followee))) {
		// 鍵アカウントであっても、既にフォローされていた場合はスルー
		const following = await server.db.followings.findOne({
			followerId: follower.id,
			followeeId: followee.id,
		});
		if (following) {
			await createFollowRequest(follower, followee, activity.id);
			return;
		}
	}

	await server.follow(followee, follower);

	if (isRemoteUser(follower) && isLocalUser(followee)) {
		const content = renderActivity(renderAccept(renderFollow(follower, followee, activity.id), followee));
		deliver(followee, content, follower.inbox);
	}
};
