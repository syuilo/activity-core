import config from '../../../config';
import { Note } from '../../../models/entities/note';
import { RemoteUser, LocalUser } from '../../../models/entities/user';
import { PollVote } from '../../../models/entities/poll-vote';
import { Poll } from '../../../models/entities/poll';

export default async function renderVote(user: LocalUser, vote: PollVote, note: Note, poll: Poll, pollOwner: RemoteUser): Promise<any> {
	return {
		id: `${server.url}/users/${user.id}#votes/${vote.id}/activity`,
		actor: `${server.url}/users/${user.id}`,
		type: 'Create',
		to: [pollOwner.uri],
		published: new Date().toISOString(),
		object: {
			id: `${server.url}/users/${user.id}#votes/${vote.id}`,
			type: 'Note',
			attributedTo: `${server.url}/users/${user.id}`,
			to: [pollOwner.uri],
			inReplyTo: note.uri,
			name: poll.choices[vote.choice]
		}
	};
}
