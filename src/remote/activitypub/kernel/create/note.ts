import Resolver from '../../resolver';
import { RemoteUser } from '../../../../models/entities/user';
import { createNote, fetchNote } from '../../models/note';
import { getApId, IObject } from '../../type';
import { getApLock } from '../../../../misc/app-lock';

/**
 * 投稿作成アクティビティを捌きます
 */
export default async function(resolver: Resolver, actor: RemoteUser, note: IObject, silent = false): Promise<void> {
	const uri = getApId(note);

	const unlock = await getApLock(uri);

	try {
		const exist = await fetchNote(note);
		if (exist == null) {
			await createNote(note);
		}
	} finally {
		unlock();
	}
}
