import { IUndo, IFollow, IBlock, ILike, IAnnounce } from '../type';
import Resolver from '../resolver';
import { apLogger } from '../logger';
import { ApServer } from '../..';
import { RemoteUser } from '../../models';

const logger = apLogger;

export default async (server: ApServer, actor: RemoteUser, activity: IUndo): Promise<void> => {
	if ('actor' in activity && actor.uri !== activity.actor) {
		throw new Error('invalid actor');
	}

	const uri = activity.id || activity;

	logger.info(`Undo: ${uri}`);

	const resolver = new Resolver(server);

	const object = await resolver.resolve(activity.object).catch(e => {
		logger.error(`Resolution failed: ${e}`);
		throw e;
	});

	switch (object.type) {
		case 'Follow':   server.activityHandlers.undoFollow(actor, object as IFollow); break;
		case 'Block':    server.activityHandlers.undoBlock(actor, object as IBlock); break;
		case 'Like':     server.activityHandlers.undoLike(actor, object as ILike); break;
		case 'Announce': server.activityHandlers.undoAnnounce(actor, object as IAnnounce); break;
		default: {
			// TODO log error
		}
	}
};
