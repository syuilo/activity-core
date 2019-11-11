import Resolver from '../../resolver';
import { RemoteUser } from '../../../../models/entities/user';
import createNote from './note';
import { ICreate, getApId, validPost } from '../../type';
import { apLogger } from '../../logger';

const logger = apLogger;

export default async (actor: RemoteUser, activity: ICreate): Promise<void> => {
	const uri = getApId(activity);

	logger.info(`Create: ${uri}`);

	const resolver = new Resolver();

	let object;

	try {
		object = await resolver.resolve(activity.object);
	} catch (e) {
		logger.error(`Resolution failed: ${e}`);
		throw e;
	}

	if (validPost.includes(object.type)) {
		createNote(resolver, actor, object);
	} else {
		logger.warn(`Unknown type: ${object.type}`);
	}
};
