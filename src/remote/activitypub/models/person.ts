import * as promiseLimit from 'promise-limit';

import Resolver from '../resolver';
import { resolveImage } from './image';
import { isCollectionOrOrderedCollection, isCollection, IPerson, getApId } from '../type';
import { resolveNote, extractEmojis } from './note';
import { ITag, extractHashtags } from './tag';
import { apLogger } from '../logger';
import { toPuny } from '../../../misc/convert-host';
import { validActor } from '../../../remote/activitypub/type';
import { toArray } from '../../../prelude/array';
import { ApServer } from '../../..';
import { User, RemoteUser, Note, Emoji } from '../../../models';
import { fetchNodeinfo } from '../../fetch-nodeinfo';
import { parseHtml } from '../../../parse-html';

const logger = apLogger;

/**
 * Validate Person object
 * @param x Fetched person object
 * @param uri Fetch target URI
 */
function validatePerson(x: any, uri: string) {
	const expectHost = toPuny(new URL(uri).hostname);

	if (x == null) {
		return new Error('invalid person: object is null');
	}

	if (!validActor.includes(x.type)) {
		return new Error(`invalid person: object is not a person or service '${x.type}'`);
	}

	if (typeof x.preferredUsername !== 'string') {
		return new Error('invalid person: preferredUsername is not a string');
	}

	if (typeof x.inbox !== 'string') {
		return new Error('invalid person: inbox is not a string');
	}

	if (!Users.validateRemoteUsername.ok(x.preferredUsername)) {
		return new Error('invalid person: invalid username');
	}

	if (x.name != null && x.name != '') {
		if (!Users.validateName.ok(x.name)) {
			return new Error('invalid person: invalid name');
		}
	}

	if (typeof x.id !== 'string') {
		return new Error('invalid person: id is not a string');
	}

	const idHost = toPuny(new URL(x.id).hostname);
	if (idHost !== expectHost) {
		return new Error('invalid person: id has different host');
	}

	if (typeof x.publicKey.id !== 'string') {
		return new Error('invalid person: publicKey.id is not a string');
	}

	const publicKeyIdHost = toPuny(new URL(x.publicKey.id).hostname);
	if (publicKeyIdHost !== expectHost) {
		return new Error('invalid person: publicKey.id has different host');
	}

	return null;
}

/**
 * Personをフェッチします。
 *
 * サーバーに対象のPersonが登録されていればそれを返します。
 */
export async function fetchPerson(server: ApServer, uri: string): Promise<User | null> {
	if (typeof uri !== 'string') throw new Error('uri is not string');

	// URIがこのサーバーを指しているならデータベースからフェッチ
	if (uri.startsWith(server.url + '/')) {
		const id = uri.split('/').pop();
		if (id == null) throw new Error('invalud uri');
		return await server.getters.findUser(id).then(x => x || null);
	}

	//#region このサーバーに既に登録されていたらそれを返す
	const exist = await server.getters.findUser({ uri });

	if (exist) {
		return exist;
	}
	//#endregion

	return null;
}

/**
 * Personを作成します。
 */
export async function createPerson(server: ApServer, uri: string, resolver?: Resolver): Promise<User> {
	if (typeof uri !== 'string') throw new Error('uri is not string');

	if (resolver == null) resolver = new Resolver(server);

	const object = await resolver.resolve(uri) as any;

	const err = validatePerson(object, uri);

	if (err) {
		throw err;
	}

	const person: IPerson = object;

	logger.info(`Creating the Person: ${person.id}`);

	const host = toPuny(new URL(object.id).hostname);

	const { fields } = analyzeAttachments(person.attachment || []);

	const tags = extractHashtags(person.tag).map(tag => tag.toLowerCase()).splice(0, 32);

	const isBot = object.type == 'Service';

	// Create user
	const user = await server.actions.createUser({
		createdAt: new Date(),
		lastFetchedAt: new Date(),
		name: person.name || null,
		avatarId: null,
		bannerId: null,
		avatarUrl: null,
		bannerUrl: null,
		isLocked: !!person.manuallyApprovesFollowers,
		username: person.preferredUsername!,
		usernameLower: person.preferredUsername!.toLowerCase(),
		host,
		inbox: person.inbox!,
		sharedInbox: person.sharedInbox || (person.endpoints ? person.endpoints.sharedInbox || null : null),
		featured: person.featured ? getApId(person.featured) : null,
		emojis: [],
		uri: person.id!,
		tags,
		isBot,
		isSuspended: false,
	}, {
		description: person.summary ? parseHtml(person.summary) : null,
		url: person.url || null,
		fields,
		userHost: host,
	}, {
		keyId: person.publicKey.id,
		keyPem: person.publicKey.publicKeyPem,
	}) as RemoteUser;

	if (server.handlers.onPersonRegistered) server.handlers.onPersonRegistered(user);
	fetchNodeinfo(server, host);

	//#region アバターとヘッダー画像をフェッチ
	const [avatar, banner] = await Promise.all([
		person.icon,
		person.image
	].map(img =>
		img == null
			? Promise.resolve(null)
			: resolveImage(server, user!, img).catch(() => null)
	));

	const avatarId = avatar ? avatar.id : null;
	const bannerId = banner ? banner.id : null;
	const avatarUrl = avatar ? server.getters.getFileUrl(avatar, true) : null;
	const bannerUrl = banner ? server.getters.getFileUrl(banner, false) : null;

	await server.actions.updateUser(user!.id, {
		avatarId,
		bannerId,
		avatarUrl,
		bannerUrl,
	});

	user!.avatarId = avatarId;
	user!.bannerId = bannerId;
	user!.avatarUrl = avatarUrl;
	user!.bannerUrl = bannerUrl;
	//#endregion

	//#region カスタム絵文字取得
	const emojis = await extractEmojis(server, person.tag || [], host).catch(e => {
		logger.info(`extractEmojis: ${e}`);
		return [] as Emoji[];
	});

	const emojiNames = emojis.map(emoji => emoji.name);

	await server.actions.updateUser(user!.id, {
		emojis: emojiNames
	});
	//#endregion

	await updateFeatured(server, user!).catch(err => logger.error(err));

	return user!;
}

/**
 * Personの情報を更新します。
 * サーバーに対象のPersonが登録されていなければ無視します。
 * @param uri URI of Person
 * @param resolver Resolver
 * @param hint Hint of Person object (この値が正当なPersonの場合、Remote resolveをせずに更新に利用します)
 */
export async function updatePerson(server: ApServer, uri: string, resolver?: Resolver | null, hint?: object): Promise<void> {
	if (typeof uri !== 'string') throw new Error('uri is not string');

	// URIがこのサーバーを指しているならスキップ
	if (uri.startsWith(server.url + '/')) {
		return;
	}

	//#region このサーバーに既に登録されているか
	const exist = await server.getters.findUser({ uri }) as RemoteUser;

	if (exist == null) {
		return;
	}
	//#endregion

	if (resolver == null) resolver = new Resolver(server);

	const object = hint || await resolver.resolve(uri) as any;

	const err = validatePerson(object, uri);

	if (err) {
		throw err;
	}

	const person: IPerson = object;

	logger.info(`Updating the Person: ${person.id}`);

	// アバターとヘッダー画像をフェッチ
	const [avatar, banner] = await Promise.all([
		person.icon,
		person.image
	].map(img =>
		img == null
			? Promise.resolve(null)
			: resolveImage(server, exist, img).catch(() => null)
	));

	// カスタム絵文字取得
	const emojis = await extractEmojis(server, person.tag || [], exist.host).catch(e => {
		logger.info(`extractEmojis: ${e}`);
		return [] as Emoji[];
	});

	const emojiNames = emojis.map(emoji => emoji.name);

	const { fields } = analyzeAttachments(person.attachment || []);

	const tags = extractHashtags(person.tag).map(tag => tag.toLowerCase()).splice(0, 32);

	const updates = {
		lastFetchedAt: new Date(),
		inbox: person.inbox,
		sharedInbox: person.sharedInbox || (person.endpoints ? person.endpoints.sharedInbox : undefined),
		featured: person.featured,
		emojis: emojiNames,
		name: person.name,
		tags,
		isBot: object.type == 'Service',
		isLocked: !!person.manuallyApprovesFollowers,
	} as Partial<User>;

	if (avatar) {
		updates.avatarId = avatar.id;
		updates.avatarUrl = server.getters.getFileUrl(avatar, true);
	}

	if (banner) {
		updates.bannerId = banner.id;
		updates.bannerUrl = server.getters.getFileUrl(banner, false);
	}

	// Update user
	await server.actions.updateUser(exist.id, updates, {
		url: person.url,
		fields,
		description: person.summary ? parseHtml(person.summary) : null,
	}, {
		keyId: person.publicKey.id,
		keyPem: person.publicKey.publicKeyPem
	});

	// 該当ユーザーが既にフォロワーになっていた場合はFollowingもアップデートする
	await server.actions.updateFollowing({
		followerId: exist.id
	}, {
		followerSharedInbox: person.sharedInbox || (person.endpoints ? person.endpoints.sharedInbox : undefined)
	});

	await updateFeatured(server, exist).catch(err => logger.error(err));
}

/**
 * Personを解決します。
 *
 * サーバーに対象のPersonが登録されていればそれを返し、そうでなければ
 * リモートサーバーからフェッチしてサーバーに登録しそれを返します。
 */
export async function resolvePerson(server: ApServer, uri: string, resolver?: Resolver): Promise<User> {
	if (typeof uri !== 'string') throw new Error('uri is not string');

	//#region このサーバーに既に登録されていたらそれを返す
	const exist = await fetchPerson(server, uri);

	if (exist) {
		return exist;
	}
	//#endregion

	// リモートサーバーからフェッチしてきて登録
	if (resolver == null) resolver = new Resolver(server);
	return await createPerson(server, uri, resolver);
}

const isPropertyValue = (x: {
		type: string,
		name?: string,
		value?: string
	}) =>
		x &&
		x.type === 'PropertyValue' &&
		typeof x.name === 'string' &&
		typeof x.value === 'string';

export function analyzeAttachments(attachments: ITag[]) {
	const fields: {
		name: string,
		value: string
	}[] = [];

	if (Array.isArray(attachments)) {
		for (const attachment of attachments.filter(isPropertyValue)) {
			fields.push({
				name: attachment.name!,
				value: parseHtml(attachment.value!)
			});
		}
	}

	return { fields };
}

export async function updateFeatured(server: ApServer, user: RemoteUser) {
	if (!user.featured) return;

	logger.info(`Updating the featured: ${user.uri}`);

	const resolver = new Resolver(server);

	// Resolve to (Ordered)Collection Object
	const collection = await resolver.resolveCollection(user.featured);
	if (!isCollectionOrOrderedCollection(collection)) throw new Error(`Object is not Collection or OrderedCollection`);

	// Resolve to Object(may be Note) arrays
	const unresolvedItems = isCollection(collection) ? collection.items : collection.orderedItems;
	const items = await Promise.all(toArray(unresolvedItems).map(x => resolver.resolve(x)));

	// Resolve and regist Notes
	const limit = promiseLimit<Note | null>(2);
	const featuredNotes = (await Promise.all(items
		.filter(item => item.type === 'Note')
		.slice(0, 5)
		.map(item => limit(() => resolveNote(server, item, resolver))))
	).filter(note => note != null);

	// Update
	await server.actions.updateFeatured(user, featuredNotes as Note[]);
}
