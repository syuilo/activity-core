import { ILike } from '../../type';
import { ApServer } from '../../../..';
import { RemoteUser } from '../../../../models';

/**
 * Process Undo.Like activity
 */
export default async (server: ApServer, actor: RemoteUser, activity: ILike): Promise<void> => {
	const id = typeof activity.object == 'string' ? activity.object : activity.object.id;
	if (id == null) throw new Error('missing id');

	const noteId = id.split('/').pop();
	if (noteId == null) {
		throw new Error('invalid url');
	}

	const note = await server.getters.findNote(noteId);
	if (note == null) {
		throw new Error('note not found');
	}

	await server.activityHandlers.undoLike(actor, note);
};
