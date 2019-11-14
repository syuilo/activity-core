import { RemoteUser } from '../../../../models/entities/user';
import deleteNode from '../../../../services/note/delete';
import { apLogger } from '../../logger';
import { Notes } from '../../../../models';

const logger = apLogger;

export default async function(actor: RemoteUser, uri: string): Promise<void> {
	logger.info(`Deleting the Note: ${uri}`);

	const note = await server.api.findNote({ uri });

	if (note == null) {
		throw new Error('note not found');
	}

	if (note.userId !== actor.id) {
		throw new Error('投稿を削除しようとしているユーザーは投稿の作成者ではありません');
	}

	await deleteNode(actor, note);
}
