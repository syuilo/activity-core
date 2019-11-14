import { ILike } from '../type';
import { apLogger } from '../logger';
import { RemoteUser } from '../../../models';
import { ApServer } from '../../..';

export default async (server: ApServer, actor: RemoteUser, activity: ILike) => {
	const id = typeof activity.object == 'string' ? activity.object : activity.object.id;
	if (id == null) throw new Error('missing id');

	// Transform:
	// https://misskey.ex/notes/xxxx to
	// xxxx
	const noteId = id.split('/').pop();
	if (noteId == null) {
		return;
	}

	const note = await server.getters.findNote(noteId);
	if (note == null) {
		apLogger.warn(`Like activity recivied, but no such note: ${id}`, { id });
		return;
	}

	await server.activityHandlers.like(actor, note, activity._misskey_reaction);
};
