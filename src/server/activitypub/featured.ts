import * as Router from '@koa/router';
import config from '../../config';
import { renderActivity } from '../../activitypub/renderer';
import renderOrderedCollection from '../../activitypub/renderer/ordered-collection';
import { setResponseType } from '../activitypub';
import renderNote from '../../activitypub/renderer/note';
import { Users, Notes, UserNotePinings } from '../../models';
import { ensure } from '../../prelude/ensure';

export default async (ctx: Router.RouterContext) => {
	const userId = ctx.params.user;

	// Verify user
	const user = await Users.findOne({
		id: userId,
		host: null
	});

	if (user == null) {
		ctx.status = 404;
		return;
	}

	const pinings = await UserNotePinings.find({
		where: { userId: user.id },
		order: { id: 'DESC' }
	});

	const pinnedNotes = await Promise.all(pinings.map(pining =>
		server.getters.findNote(pining.noteId).then(ensure)));

	const renderedNotes = await Promise.all(pinnedNotes.map(note => renderNote(note)));

	const rendered = renderOrderedCollection(
		`${server.url}/users/${userId}/collections/featured`,
		renderedNotes.length, undefined, undefined, renderedNotes
	);

	ctx.body = renderActivity(rendered);
	ctx.set('Cache-Control', 'private, max-age=0, must-revalidate');
	setResponseType(ctx);
};
