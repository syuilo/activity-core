import * as Router from '@koa/router';
import { ApServer } from '..';

export const links = [/* (awaiting release) {
	rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
	href: server.url + nodeinfo2_1path
}, */{
	rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
	href: server.url + nodeinfo2_0path
}];

export function cerateNodeinfoRouter(server: ApServer) {
	const router = new Router();

	const nodeinfo2_1path = '/nodeinfo/2.1';
	const nodeinfo2_0path = '/nodeinfo/2.0';

	router.get(nodeinfo2_1path, async ctx => {
		const base = await server.getNodeinfo();

		ctx.body = { version: '2.1', ...base };
	});

	router.get(nodeinfo2_0path, async ctx => {
		const base = await server.getNodeinfo();

		delete base.software.repository;

		ctx.body = { version: '2.0', ...base };
	});

	return router;
}
