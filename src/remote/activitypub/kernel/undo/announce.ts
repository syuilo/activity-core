import { Notes } from '../../../../models';
import { RemoteUser } from '../../../../models/entities/user';
import { IAnnounce, getApId } from '../../type';
import deleteNote from '../../../../services/note/delete';

export const undoAnnounce = async (actor: RemoteUser, activity: IAnnounce): Promise<void> => {
	const uri = getApId(activity);

	const note = await server.getters.findNote({
		uri
	});

	if (!note) return;

	await deleteNote(actor, note);
};
