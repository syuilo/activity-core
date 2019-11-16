import renderImage from './image';
import renderKey from './key';
import { toHtml } from '../../../mfm/toHtml';
import { parse } from '../../../mfm/parse';
import { getEmojis } from './note';
import renderEmoji from './emoji';
import { IIdentifier } from '../models/identifier';
import renderHashtag from './hashtag';
import { ApServer } from '../..';
import { LocalUser } from '../../models';

export async function renderPerson(server: ApServer, user: LocalUser) {
	const id = `${server.url}/users/${user.id}`;

	const profile = await server.getUserProfile(user.id);

	const attachment: {
		type: 'PropertyValue',
		name: string,
		value: string,
		identifier?: IIdentifier
	}[] = [];

	if (profile.fields) {
		for (const field of profile.fields) {
			attachment.push({
				type: 'PropertyValue',
				name: field.name,
				value: (field.value != null && field.value.match(/^https?:/))
					? `<a href="${new URL(field.value).href}" rel="me nofollow noopener" target="_blank">${new URL(field.value).href}</a>`
					: field.value
			});
		}
	}

	const emojis = await getEmojis(user.emojis);
	const apemojis = emojis.map(emoji => renderEmoji(emoji));

	const hashtagTags = (user.tags || []).map(tag => renderHashtag(tag));

	const tag = [
		...apemojis,
		...hashtagTags,
	];

	const keypair = await server.getUserKeypair(user.id);

	return {
		type: user.isBot ? 'Service' : 'Person',
		id,
		inbox: `${id}/inbox`,
		outbox: `${id}/outbox`,
		followers: `${id}/followers`,
		following: `${id}/following`,
		featured: `${id}/collections/featured`,
		sharedInbox: `${server.url}/inbox`,
		endpoints: { sharedInbox: `${server.url}/inbox` },
		url: `${server.url}/@${user.username}`,
		preferredUsername: user.username,
		name: user.name,
		summary: toHtml(parse(profile.description)),
		icon: user.avatarUrl ? renderImage({ url: user.avatarUrl, isSensitive: false }) : null,
		image: user.bannerUrl ? renderImage({ url: user.bannerUrl, isSensitive: false }) : null,
		tag,
		manuallyApprovesFollowers: user.isLocked,
		publicKey: renderKey(user, keypair),
		attachment: attachment.length ? attachment : undefined
	};
}
