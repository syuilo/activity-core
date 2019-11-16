import config from '../../../config';

export default (tag: string) => ({
	type: 'Hashtag',
	href: `${server.url}/tags/${encodeURIComponent(tag)}`,
	name: `#${tag}`
});
