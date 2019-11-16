import * as Koa from 'koa';
import * as Router from '@koa/router';
import * as https from 'https';
import { sign } from 'http-signature';
import * as crypto from 'crypto';
import * as cache from 'lookup-dns-cache';
import * as httpsProxyAgent from 'https-proxy-agent';
import { createActivityPubRouter } from './server/activitypub';
import { cerateWellKnownRouter } from './server/well-known';
import { cerateNodeinfoRouter } from './server/nodeinfo';
import { Nodeinfo } from './nodeinfo';
import { User, UserKeypair, UserProfile, RemoteUser, Note, Instance, LocalUser, UserPublickey, File, Following, Emoji, Blocking, Poll } from './models';
import { Queue } from './queue';
import { renderActivity } from './activitypub/renderer';
import { deliverToFollowers } from './activitypub/deliver-manager';
import { IFollow, IBlock, IAnnounce, ILike } from './activitypub/type';

type Maybe<T> = T | null | undefined;

export type Options = {
	url: string;
	userAgent?: string;
	proxy?: string;
	queue: Queue;

	nodeinfo?: () => Promise<Nodeinfo>;

	getters: {
		findUsers: (query: Partial<User>) => Promise<User[]>;

		findUser: (query: User['id'] | Partial<User>) => Promise<Maybe<User>>;
	
		findNote: (query: Note['id'] | Partial<Note>) => Promise<Maybe<Note>>;

		findPoll: (query: Note['id']) => Promise<Maybe<Poll>>;
	
		findEmoji: (query: Emoji['id'] | Partial<Emoji>) => Promise<Maybe<Emoji>>;

		findBlocking: (query: Blocking['id'] | Partial<Blocking>) => Promise<Maybe<Blocking>>;

		findFollowing: (query: Following['id'] | Partial<Following>) => Promise<Maybe<Following>>;
	
		findFollowings: (query: Partial<Following>) => Promise<Following[]>;	

		getUserKeypair: (userId: User['id']) => Promise<UserKeypair>;

		getUserProfile: (userId: User['id']) => Promise<UserProfile>;
	
		getFileUrl: (file: File, thumbnail: boolean) => string;
	
		getBlockedHosts: () => string[];
	
		getInstance?: (host: string) => Promise<Instance>;
	};

	actions: {
		createUser: (user: Omit<User, 'id'>, profile: UserProfile, key: UserPublickey) => Promise<User>;

		/**
		 * ユーザー情報を更新するハンドラ
		 * ハッシュタグデータベースの更新も行うべき
		 */
		updateUser: (userId: User['id'], user: Partial<User>, profile?: Partial<UserProfile>, key?: Partial<UserPublickey>) => Promise<void>;

		/**
		 * 投稿をデータベースに保存するハンドラ
		 */
		insertNoteSilently: (user: RemoteUser, note: Omit<Note, 'id'>) => Promise<Note>;
	
		createEmoji: (emoji: Omit<Emoji, 'id'>) => Promise<Emoji>;
	
		updateEmoji: (query: Emoji['id'] | Partial<Emoji>, fields: Partial<Emoji>) => Promise<void>;
	
		/**
		 * ピン留めされた投稿を更新するハンドラ
		 */
		updateFeatured: (user: RemoteUser, toes: Note[]) => Promise<void>;
	
		updateFollowing: (query: Partial<Following>, fields: Partial<Following>) => Promise<void>;
	
		/**
		 * ファイルをリモートサーバーからダウンロードするハンドラ
		 */
		createFile: (url: string, user: RemoteUser, isSensitive: boolean) => Promise<File>;
	
		setInstance?: (host: string, props: Record<string, any>) => Promise<void>;
	};

	activityHandlers: {
		undoFollow: (actor: RemoteUser, object: IFollow) => Promise<void>;
		undoBlock: (actor: RemoteUser, object: IBlock) => Promise<void>;
		undoLike: (actor: RemoteUser, object: ILike) => Promise<void>;
		undoAnnounce: (actor: RemoteUser, object: IAnnounce) => Promise<void>;
	},

	listeners: {
		/**
		 * 新しいアカウントが登録されたときに呼ばれます
		 */
		onPersonRegistered?: (user: RemoteUser) => void;
	};
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

	public get proxy() {
		return this.opts.proxy;
	}

	public get userAgent() {
		return this.opts.userAgent || 'ActivityCore';
	}

	public get getters() {
		return this.opts.getters;
	}

	public get actions() {
		return this.opts.actions;
	}

	public get activityHandlers() {
		return this.opts.activityHandlers;
	}

	public get listeners() {
		return this.opts.listeners;
	}

	public get queue() {
		return this.opts.queue;
	}
	//#endregion

	private agent: https.Agent;

	constructor(app: Koa, opts: Options) {
		this.opts = opts;

		this.agent = opts.proxy
			? new httpsProxyAgent(opts.proxy)
			: new https.Agent({
					lookup: cache.lookup,
				});

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

	public async deliverLocalNoteDeleted(note: Note) {
		let renote: Note | undefined;

		if (note.renoteId && note.text == null && !note.hasPoll && (note.fileIds == null || note.fileIds.length == 0)) {
			renote = await this.api.findNote(note.renoteId);
		}

		const content = renderActivity(renote
			? renderUndo(renderAnnounce(renote.uri || `${server.url}/notes/${renote.id}`, note), user)
			: renderDelete(renderTombstone(`${server.url}/notes/${note.id}`), user));

		deliverToFollowers(this, user, content);
	}

	public async request(user: LocalUser, url: string, object: any) {
		const timeout = 10 * 1000;
	
		const { protocol, hostname, port, pathname, search } = new URL(url);
	
		const data = JSON.stringify(object);
	
		const sha256 = crypto.createHash('sha256');
		sha256.update(data);
		const hash = sha256.digest('base64');
	
		const keypair = await this.getUserKeypair(user.id);
	
		await new Promise((resolve, reject) => {
			const req = https.request({
				agent: this.agent,
				protocol,
				hostname,
				port,
				method: 'POST',
				path: pathname + search,
				timeout,
				headers: {
					'User-Agent': this.userAgent,
					'Content-Type': 'application/activity+json',
					'Digest': `SHA-256=${hash}`
				}
			}, res => {
				if (res.statusCode! >= 400) {
					reject(res);
				} else {
					resolve();
				}
			});
	
			sign(req, {
				authorizationHeaderName: 'Signature',
				key: keypair.privateKey,
				keyId: `${this.url}/users/${user.id}/publickey`,
				headers: ['date', 'host', 'digest']
			});
	
			// Signature: Signature ... => Signature: ...
			let sig = req.getHeader('Signature')!.toString();
			sig = sig.replace(/^Signature /, '');
			req.setHeader('Signature', sig);
	
			req.on('timeout', () => req.abort());
	
			req.on('error', e => {
				if (req.aborted) reject('timeout');
				reject(e);
			});
	
			req.end(data);
		});
	
		//TODO emit event
	}

	public followRequestAccepted() {
		const content = renderActivity(renderAccept(renderFollow(follower, followee, request.requestId!), followee as ILocalUser));
		deliver(followee as ILocalUser, content, follower.inbox);
	}

	public noteCreated() {

	}

	public followRequest() {
		const content = renderActivity(renderFollow(follower, followee));
		deliver(follower, content, followee.inbox);
	}
}
