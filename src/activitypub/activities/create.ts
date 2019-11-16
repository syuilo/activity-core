import Resolver from '../resolver';
import { ICreate, getApId, validPost } from '../type';
import { apLogger } from '../logger';
import { ApServer } from '../..';
import { RemoteUser } from '../../models';

const logger = apLogger;

export default async (server: ApServer, actor: RemoteUser, activity: ICreate): Promise<void> => {
	const uri = getApId(activity);

	logger.info(`Create: ${uri}`);

	const resolver = new Resolver(server);

	const object = await resolver.resolve(activity.object).catch(e => {
		logger.error(`Resolution failed: ${e}`);
		throw e;
	});

	if (validPost.includes(object.type)) {
		server.activityHandlers.createNote(actor, object);
	} else {
		logger.warn(`Unknown type: ${object.type}`);
	}
};
