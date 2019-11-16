import config from '../../../config';
import { Note } from '../../../models/entities/note';

export default (object: any, note: Note) => {
	const activity = {
		id: `${server.url}/notes/${note.id}/activity`,
		actor: `${server.url}/users/${note.userId}`,
		type: 'Create',
		published: note.createdAt.toISOString(),
		object
	} as any;

	if (object.to) activity.to = object.to;
	if (object.cc) activity.cc = object.cc;

	return activity;
};
