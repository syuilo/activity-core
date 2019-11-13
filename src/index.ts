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
import { User, UserKeypair, UserProfile, RemoteUser, Note, Instance, LocalUser, UserPublickey, File } from './models';
import { Queue } from './queue';

type Maybe<T> = T | null | undefined;

type API = {
	findUsers: (query: Partial<User>) => Promise<User[]>;

	findUser: (query: User['id'] | Partial<User>) => Promise<Maybe<User>>;

	createUser: (user: Omit<User, 'id'>, profile: UserProfile, key: UserPublickey) => Promise<User>;

	/**
	 * ユーザー情報を更新するハンドラ
	 * ハッシュタグデータベースの更新も行うべき
	 */
	updateUser: (userId: User['id'], user: Partial<User>, profile: Partial<UserProfile>, key: Partial<UserPublickey>) => Promise<User>;

	/**
	 * ピン留めされた投稿を更新するハンドラ
	 */
	updateFeatured: (user: RemoteUser, ntoes: Note[]) => Promise<void>;

	/**
	 * ファイルをリモートサーバーからダウンロードするハンドラ
	 */
	createFile: (url: string, user: RemoteUser, isSensitive: boolean) => Promise<File>;

	getUserKeypair: (userId: User['id']) => Promise<UserKeypair>;

	getUserProfile: (userId: User['id']) => Promise<UserProfile>;

	getFileUrl: (file: File, thumbnail: boolean) => string;

	getBlockedHosts: () => string[];

	getInstance?: (host: string) => Promise<Instance>;

	setInstance?: (host: string, props: Record<string, any>) => Promise<void>;
};

export type Options = {
	url: string;
	userAgent?: string;
	proxy?: string;
	queue: Queue;

	nodeinfo?: () => Promise<Nodeinfo>;

	api: API;

	handlers: {
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

	public get api() {
		return this.opts.api;
	}

	public get handlers() {
		return this.opts.handlers;
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
			renote = await this.db.notes.findOne(note.renoteId);
		}

		const content = renderActivity(renote
			? renderUndo(renderAnnounce(renote.uri || `${server.url}/notes/${renote.id}`, note), user)
			: renderDelete(renderTombstone(`${server.url}/notes/${note.id}`), user));

		deliverToFollowers(user, content);
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
}
