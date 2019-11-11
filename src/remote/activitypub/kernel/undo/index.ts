import { RemoteUser } from '../../../../models/entities/user';
import { IUndo, IFollow, IBlock, ILike, IAnnounce } from '../../type';
import unfollow from './follow';
import unblock from './block';
import undoLike from './like';
import { undoAnnounce } from './announce';
import Resolver from '../../resolver';
import { apLogger } from '../../logger';

const logger = apLogger;

export default async (actor: RemoteUser, activity: IUndo): Promise<void> => {
	if ('actor' in activity && actor.uri !== activity.actor) {
		throw new Error('invalid actor');
	}

	const uri = activity.id || activity;

	logger.info(`Undo: ${uri}`);

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
			unfollow(actor, object as IFollow);
			break;
		case 'Block':
			unblock(actor, object as IBlock);
			break;
		case 'Like':
			undoLike(actor, object as ILike);
			break;
		case 'Announce':
			undoAnnounce(actor, object as IAnnounce);
			break;
	}
};
