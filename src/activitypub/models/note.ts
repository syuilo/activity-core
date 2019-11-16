import * as promiseLimit from 'promise-limit';
import Resolver from '../resolver';
import { IObject, INote, getApIds, getOneApId, getApId, validPost } from '../type';
import { getApLock } from '../../misc/app-lock';
import { Emoji, Note, User, RemoteUser } from '../../models';
import { parseHtml } from '../../parse-html';
import { resolvePerson, updatePerson } from './person';
import { ApServer } from '../..';
import { resolveImage } from './image';
import { ITag, extractHashtags } from './tag';
import { toPuny, extractPunyedHost } from '../../misc/convert-host';
import { difference, unique, concat } from '../../prelude/array';
import { extractPollFromQuestion } from './question';

const logger = apLogger;

export function validateNote(object: any, uri: string) {
	const expectHost = extractPunyedHost(uri);

	if (object == null) {
		return new Error('invalid Note: object is null');
	}

	if (!validPost.includes(object.type)) {
		return new Error(`invalid Note: invalid object type ${object.type}`);
	}

	if (object.id && extractPunyedHost(object.id) !== expectHost) {
		return new Error(`invalid Note: id has different host. expected: ${expectHost}, actual: ${extractPunyedHost(object.id)}`);
	}

	if (object.attributedTo && extractPunyedHost(getOneApId(object.attributedTo)) !== expectHost) {
		return new Error(`invalid Note: attributedTo has different host. expected: ${expectHost}, actual: ${extractPunyedHost(object.attributedTo)}`);
	}

	return null;
}

/**
 * Noteをフェッチします。
 *
 * サーバーに対象のNoteが登録されていればそれを返します。
 */
export async function fetchNote(server: ApServer, value: string | IObject, resolver?: Resolver): Promise<Note | null> {
	const uri = getApId(value);

	// URIがこのサーバーを指しているならデータベースからフェッチ
	if (uri.startsWith(server.url + '/')) {
		const id = uri.split('/').pop();
		if (id == null) throw new Error('Invalid URL');
		return await server.getters.findNote(id).then(x => x || null);
	}

	//#region このサーバーに既に登録されていたらそれを返す
	const exist = await server.getters.findNote({ uri });

	if (exist) {
		return exist;
	}
	//#endregion

	return null;
}

/**
 * Noteを作成します。
 */
export async function createNote(server: ApServer, value: string | IObject, resolver?: Resolver, silent: boolean): Promise<Note | null> {
	if (resolver == null) resolver = new Resolver(server);

	const object: any = await resolver.resolve(value);

	const entryUri = getApId(value);
	const err = validateNote(object, entryUri);
	if (err) {
		logger.error(`${err.message}`, {
			resolver: {
				history: resolver.getHistory()
			},
			value: value,
			object: object
		});
		throw new Error('invalid note');
	}

	const note: INote = object;

	logger.debug(`Note fetched: ${JSON.stringify(note, null, 2)}`);

	logger.info(`Creating the Note: ${note.id}`);

	// 投稿者をフェッチ
	const actor = await resolvePerson(server, getOneApId(note.attributedTo), resolver) as RemoteUser;

	// 投稿者が凍結されていたらスキップ
	if (actor.isSuspended) {
		throw new Error('actor has been suspended');
	}

	//#region Visibility
	const to = getApIds(note.to);
	const cc = getApIds(note.cc);

	let visibility = 'public';
	let visibleUsers: User[] = [];
	if (!to.includes('https://www.w3.org/ns/activitystreams#Public')) {
		if (cc.includes('https://www.w3.org/ns/activitystreams#Public')) {
			visibility = 'home';
		} else if (to.includes(`${actor.uri}/followers`)) {	// TODO: person.followerと照合するべき？
			visibility = 'followers';
		} else {
			visibility = 'specified';
			visibleUsers = await Promise.all(to.map(uri => resolvePerson(server, uri, resolver)));
		}
	}
	//#endergion

	const apMentions = await extractMentionedUsers(server, actor, to, cc, resolver);

	const apHashtags = await extractHashtags(note.tag);

	// 添付ファイル
	// TODO: attachmentは必ずしもImageではない
	// TODO: attachmentは必ずしも配列ではない
	// Noteがsensitiveなら添付もsensitiveにする
	const limit = promiseLimit(2);

	note.attachment = Array.isArray(note.attachment) ? note.attachment : note.attachment ? [note.attachment] : [];
	const files = note.attachment
		.map(attach => attach.sensitive = note.sensitive)
		? (await Promise.all(note.attachment.map(x => limit(() => resolveImage(server, actor, x)) as Promise<File>)))
			.filter(image => image != null)
		: [];

	// リプライ
	const reply: Note | null = note.inReplyTo
		? await resolveNote(server, note.inReplyTo, resolver).then(x => {
			if (x == null) {
				logger.warn(`Specified inReplyTo, but nout found`);
				throw new Error('inReplyTo not found');
			} else {
				return x;
			}
		}).catch(e => {
			logger.warn(`Error in inReplyTo ${note.inReplyTo} - ${e.statusCode || e}`);
			throw e;
		})
		: null;

	// 引用
	let quote: Note | undefined | null;

	if (note._misskey_quote && typeof note._misskey_quote == 'string') {
		quote = await resolveNote(server, note._misskey_quote).catch(e => {
			// 4xxの場合は引用してないことにする
			if (e.statusCode >= 400 && e.statusCode < 500) {
				logger.warn(`Ignored quote target ${note.inReplyTo} - ${e.statusCode} `);
				return null;
			}
			logger.warn(`Error in quote target ${note.inReplyTo} - ${e.statusCode || e}`);
			throw e;
		});
	}

	const cw = note.summary === '' ? null : note.summary;

	// テキストのパース
	const text = note._misskey_content || (note.content ? parseHtml(note.content) : null);

	// vote
	if (reply && reply.hasPoll) {
		const poll = await server.getters.findPoll(reply.id);

		if (poll == null) throw new Error('Poll not found');

		const tryCreateVote = async (name: string, index: number): Promise<null> => {
			if (poll.expiresAt && Date.now() > new Date(poll.expiresAt).getTime()) {
				logger.warn(`vote to expired poll from AP: actor=${actor.username}@${actor.host}, note=${note.id}, choice=${name}`);
			} else if (index >= 0) {
				logger.info(`vote from AP: actor=${actor.username}@${actor.host}, note=${note.id}, choice=${name}`);
				await vote(actor, reply, index);

				// リモートフォロワーにUpdate配信
				deliverQuestionUpdate(reply.id);
			}
			return null;
		};

		if (note.name) {
			return await tryCreateVote(note.name, poll.choices.findIndex(x => x === note.name));
		}
	}

	const emojis = await extractEmojis(server, note.tag || [], actor.host).catch(e => {
		logger.info(`extractEmojis: ${e}`);
		return [] as Emoji[];
	});

	const apEmojis = emojis.map(emoji => emoji.name);

	const poll = await extractPollFromQuestion(server, note, resolver).catch(() => undefined);

	// ユーザーの情報が古かったらついでに更新しておく
	if (actor.lastFetchedAt == null || Date.now() - actor.lastFetchedAt.getTime() > 1000 * 60 * 60 * 24) {
		if (actor.uri) updatePerson(server, actor.uri);
	}

	const data = {
		createdAt: note.published ? new Date(note.published) : null,
		files,
		reply,
		renote: quote,
		name: note.name,
		cw,
		text,
		visibility,
		visibleUsers,
		apMentions,
		apHashtags,
		apEmojis,
		poll,
		uri: note.id
	};

	return silent ? await server.actions.insertNoteSilently(actor, data) : data;
}

/**
 * Noteを解決します。
 *
 * サーバーに対象のNoteが登録されていればそれを返し、そうでなければ
 * リモートサーバーからフェッチしてサーバーに登録しそれを返します。
 */
export async function resolveNote(server: ApServer, value: string | IObject, resolver?: Resolver): Promise<Note | null> {
	const uri = typeof value == 'string' ? value : value.id;
	if (uri == null) throw new Error('missing uri');

	// ブロックしてたら中断
	if (server.actions.getBlockedHosts().includes(extractPunyedHost(uri))) throw { statusCode: 451 };

	const unlock = await getApLock(uri);

	try {
		//#region このサーバーに既に登録されていたらそれを返す
		const exist = await fetchNote(server, uri);

		if (exist) {
			return exist;
		}
		//#endregion

		// リモートサーバーからフェッチしてきて登録
		// ここでuriの代わりに添付されてきたNote Objectが指定されていると、サーバーフェッチを経ずにノートが生成されるが
		// 添付されてきたNote Objectは偽装されている可能性があるため、常にuriを指定してサーバーフェッチを行う。
		return await createNote(server, uri, resolver, true);
	} finally {
		unlock();
	}
}

export async function extractEmojis(server: ApServer, tags: ITag[], host: string): Promise<Emoji[]> {
	host = toPuny(host);

	if (!tags) return [];

	const eomjiTags = tags.filter(tag => tag.type === 'Emoji' && tag.icon && tag.icon.url && tag.name);

	return await Promise.all(eomjiTags.map(async tag => {
		const name = tag.name!.replace(/^:/, '').replace(/:$/, '');

		const exists = await server.getters.findEmoji({
			host,
			name
		});

		if (exists) {
			if ((tag.updated != null && exists.updatedAt == null)
				|| (tag.id != null && exists.uri == null)
				|| (tag.updated != null && exists.updatedAt != null && new Date(tag.updated) > exists.updatedAt)
				|| (tag.icon!.url !== exists.url)
			) {
				await server.actions.updateEmoji({
					host,
					name,
				}, {
					uri: tag.id,
					url: tag.icon!.url,
					updatedAt: new Date(),
				});

				return (await server.getters.findEmoji({
					host,
					name
				}))!;
			}

			return exists;
		}

		logger.info(`register emoji host=${host}, name=${name}`);

		return await server.actions.createEmoji({
			host,
			name,
			uri: tag.id,
			url: tag.icon!.url!,
			updatedAt: new Date(),
		});
	}));
}

async function extractMentionedUsers(server: ApServer, actor: RemoteUser, to: string[], cc: string[], resolver: Resolver) {
	const ignoreUris = ['https://www.w3.org/ns/activitystreams#Public', `${actor.uri}/followers`];
	const uris = difference(unique(concat([to || [], cc || []])), ignoreUris);

	const limit = promiseLimit<User | null>(2);
	const users = await Promise.all(
		uris.map(uri => limit(() => resolvePerson(server, uri, resolver).catch(() => null)) as Promise<User | null>)
	);

	return users.filter(x => x != null) as User[];
}
