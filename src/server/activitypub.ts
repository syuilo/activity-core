import * as Router from '@koa/router';
import * as json from 'koa-json-body';
import * as httpSignature from 'http-signature';

import { renderActivity } from '../remote/activitypub/renderer';
import renderNote from '../remote/activitypub/renderer/note';
import renderKey from '../remote/activitypub/renderer/key';
import { renderPerson } from '../remote/activitypub/renderer/person';
import Outbox, { packActivity } from './activitypub/outbox';
import Followers from './activitypub/followers';
import Following from './activitypub/following';
import Featured from './activitypub/featured';
import { isSelfHost } from '../misc/convert-host';
import { ApServer } from '..';
import { isLocalUser, User, LocalUser } from '../models';

function inbox(ctx: Router.RouterContext) {
	let signature;

	ctx.req.headers.authorization = `Signature ${ctx.req.headers.signature}`;

	try {
		signature = httpSignature.parseRequest(ctx.req, { 'headers': [] });
	} catch (e) {
		ctx.status = 401;
		return;
	}

	processInbox(ctx.request.body, signature);

	ctx.status = 202;
}

const ACTIVITY_JSON = 'application/activity+json; charset=utf-8';
const LD_JSON = 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"; charset=utf-8';

function isActivityPubReq(ctx: Router.RouterContext) {
	ctx.response.vary('Accept');
	const accepted = ctx.accepts('html', ACTIVITY_JSON, LD_JSON);
	return typeof accepted === 'string' && !accepted.match(/html/);
}

export function setResponseType(ctx: Router.RouterContext) {
	const accept = ctx.accepts(ACTIVITY_JSON, LD_JSON);
	if (accept === LD_JSON) {
		ctx.response.type = LD_JSON;
	} else {
		ctx.response.type = ACTIVITY_JSON;
	}
}

export function createActivityPubRouter(server: ApServer) {
	// Init router
	const router = new Router();

	// inbox
	router.post('/inbox', json(), inbox);
	router.post('/users/:user/inbox', json(), inbox);

	// note
	router.get('/notes/:note', async (ctx, next) => {
		if (!isActivityPubReq(ctx)) return await next();

		const note = await server.getters.findNote(ctx.params.note);

		if (note == null || !['public', 'home'].includes(note.visibility)) {
			ctx.status = 404;
			return;
		}

		// リモートだったらリダイレクト
		if (note.userHost != null) {
			if (note.uri == null || isSelfHost(note.userHost)) {
				ctx.status = 500;
				return;
			}
			ctx.redirect(note.uri);
			return;
		}

		ctx.body = renderActivity(await renderNote(note, false));
		ctx.set('Cache-Control', 'public, max-age=180');
		setResponseType(ctx);
	});

	// note activity
	router.get('/notes/:note/activity', async ctx => {
		const note = await server.getters.findNote(ctx.params.note);

		if (note == null || note.userHost != null || !['public', 'home'].includes(note.visibility)) {
			ctx.status = 404;
			return;
		}

		ctx.body = renderActivity(await packActivity(note));
		ctx.set('Cache-Control', 'public, max-age=180');
		setResponseType(ctx);
	});

	// outbox
	router.get('/users/:user/outbox', Outbox);

	// followers
	router.get('/users/:user/followers', Followers);

	// following
	router.get('/users/:user/following', Following);

	// featured
	router.get('/users/:user/collections/featured', Featured);

	// publickey
	router.get('/users/:user/publickey', async ctx => {
		const userId = ctx.params.user;

		const user = await server.getters.findUser(userId);

		if (user == null || user.host !== null) {
			ctx.status = 404;
			return;
		}

		const keypair = await server.getUserKeypair(user.id);

		if (isLocalUser(user)) {
			ctx.body = renderActivity(renderKey(user, keypair));
			ctx.set('Cache-Control', 'public, max-age=180');
			setResponseType(ctx);
		} else {
			ctx.status = 400;
		}
	});

	// user
	async function userInfo(ctx: Router.RouterContext, user: User | null | undefined) {
		if (user == null) {
			ctx.status = 404;
			return;
		}

		ctx.body = renderActivity(await renderPerson(server, user as LocalUser));
		ctx.set('Cache-Control', 'public, max-age=180');
		setResponseType(ctx);
	}

	router.get('/users/:user', async (ctx, next) => {
		if (!isActivityPubReq(ctx)) return await next();

		const userId = ctx.params.user;

		const user = await server.getters.findUser({
			id: userId,
			host: null
		});

		await userInfo(ctx, user);
	});

	router.get('/@:user', async (ctx, next) => {
		if (!isActivityPubReq(ctx)) return await next();

		const user = await server.getters.findUser({
			usernameLower: ctx.params.user.toLowerCase(),
			host: null
		});

		await userInfo(ctx, user);
	});

	// emoji
	router.get('/emojis/:emoji', async ctx => {
		const emoji = await server.getters.findEmoji({
			host: null,
			name: ctx.params.emoji
		});

		if (emoji == null) {
			ctx.status = 404;
			return;
		}

		ctx.body = renderActivity(await renderEmoji(emoji));
		ctx.set('Cache-Control', 'public, max-age=180');
		setResponseType(ctx);
	});

	return router;
}
