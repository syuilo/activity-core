import { IObject } from './type';
import { RemoteUser } from '../../models/entities/user';
import { performActivity } from './kernel';

export default async (actor: RemoteUser, activity: IObject): Promise<void> => {
	await performActivity(actor, activity);
};
