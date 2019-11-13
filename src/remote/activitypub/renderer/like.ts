import config from '../../../config';
import { LocalUser } from '../../../models/entities/user';
import { Note } from '../../../models/entities/note';

export default (user: LocalUser, note: Note, reaction: string) => ({
	type: 'Like',
	actor: `${server.url}/users/${user.id}`,
	object: note.uri ? note.uri : `${server.url}/notes/${note.id}`,
	_misskey_reaction: reaction
});
