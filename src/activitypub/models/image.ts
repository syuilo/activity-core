import Resolver from '../resolver';
import { File, RemoteUser } from '../../models';
import { ApServer } from '../..';

const logger = apLogger;

/**
 * Imageを作成します。
 */
export async function createImage(server: ApServer, actor: RemoteUser, value: any): Promise<File> {
	// 投稿者が凍結されていたらスキップ
	if (actor.isSuspended) {
		throw new Error('actor has been suspended');
	}

	const image = await new Resolver(server).resolve(value) as any;

	if (image.url == null) {
		throw new Error('invalid image: url not privided');
	}

	logger.info(`Creating the Image: ${image.url}`);

	const file = await server.actions.createFile(image.url, actor, image.sensitive);

	return file;
}

/**
 * Imageを解決します。
 *
 * サーバーに対象のImageが登録されていればそれを返し、そうでなければ
 * リモートサーバーからフェッチしてサーバーに登録しそれを返します。
 */
export async function resolveImage(server: ApServer, actor: RemoteUser, value: any): Promise<File> {
	// TODO

	// リモートサーバーからフェッチしてきて登録
	return await createImage(server, actor, value);
}
