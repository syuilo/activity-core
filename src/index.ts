import * as Koa from 'koa';
import * as Router from '@koa/router';

import { createActivityPubRouter } from './server/activitypub';
import { cerateWellKnownRouter } from './server/well-known';
import { cerateNodeinfoRouter } from './server/nodeinfo';
import { DB } from './db';
import { Nodeinfo } from './nodeinfo';
import { User, UserKeypair, UserProfile, RemoteUser, Note, Instance, LocalUser } from './models';
import { Queue } from './queue';

export type Options = {
	url: string;
	db: DB;
	queue: Queue;
	nodeinfo?: () => Promise<Nodeinfo>;
	getUserKeypair: (userId: User['id']) => Promise<UserKeypair>;
	getUserProfile: (userId: User['id']) => Promise<UserProfile>;
	saveUser: (user: User, profile: UserProfile, keypair: UserKeypair) => Promise<User>;
	updateFeatured: (user: RemoteUser, ntoes: Note[]) => Promise<void>;
	onPersonRegistered?: (user: RemoteUser) => void;
	getInstance?: (host: string) => Promise<Instance>;
	setInstance?: (host: string, props: Record<string, any>) => Promise<void>;
	follow: (follower: RemoteUser, followee: LocalUser) => void;
	unblock: (blocker: RemoteUser, blockee: LocalUser) => void;
};

export class ApServer {
	private opts: Options;

	//#region Mappings
	public get url() {
		return this.opts.url;
	}

	public get host() {
		return new URL(this.url).host;
	}

	public get db() {
		return this.opts.db;
	}

	public get queue() {
		return this.opts.queue;
	}

	public get getUserKeypair() {
		return this.opts.getUserKeypair;
	}

	public get getUserProfile() {
		return this.opts.getUserProfile;
	}

	public get saveUser() {
		return this.opts.saveUser;
	}

	public get updateFeatured() {
		return this.opts.updateFeatured;
	}

	public get onPersonRegistered() {
		return this.opts.onPersonRegistered;
	}

	public get getInstance() {
		return this.opts.getInstance;
	}

	public get setInstance() {
		return this.opts.setInstance;
	}

	public get follow() {
		return this.opts.follow;
	}

	public get unblock() {
		return this.opts.unblock;
	}
	//#endregion

	constructor(app: Koa, opts: Options) {
		this.opts = opts;

		// Init router
		const router = new Router();

		// Routing
		router.use(createActivityPubRouter(this).routes());
		router.use(cerateNodeinfoRouter(this).routes());
		router.use(cerateWellKnownRouter(this).routes());

		// Register router
		app.use(router.routes());
	}

	public async getNodeinfo(): Promise<Nodeinfo> {
		if (this.opts.nodeinfo) {
			return await this.opts.nodeinfo();
		} else {
			return {
				// TODO
			};
		}
	}

	public deliverLocalNoteDeleted(note: Note) {
		let renote: Note | undefined;

		if (note.renoteId && note.text == null && !note.hasPoll && (note.fileIds == null || note.fileIds.length == 0)) {
			renote = await Notes.findOne({
				id: note.renoteId
			});
		}

		const content = renderActivity(renote
			? renderUndo(renderAnnounce(renote.uri || `${config.url}/notes/${renote.id}`, note), user)
			: renderDelete(renderTombstone(`${config.url}/notes/${note.id}`), user));

		deliverToFollowers(user, content);
	}
}
