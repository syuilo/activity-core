import * as request from 'request-promise-native';
import { Instance } from '../models/entities/instance';
import { Instances } from '../models';
import config from '../config';
import { getNodeinfoLock } from '../misc/app-lock';
import Logger from '../services/logger';
import { ApServer } from '..';

export const logger = new Logger('nodeinfo', 'cyan');

export async function fetchNodeinfo(server: ApServer, host: string) {
	if (server.getInstance == null || server.setInstance == null) return;

	const unlock = await server.getNodeinfoLock(host);

	const instance = await server.getInstance(host);
	const now = Date.now();
	if (instance && instance.infoUpdatedAt && (now - instance.infoUpdatedAt.getTime() < 1000 * 60 * 60 * 24)) {
		unlock();
		return;
	}

	logger.info(`Fetching nodeinfo of ${host} ...`);

	try {
		const wellknown = await request({
			url: 'https://' + host + '/.well-known/nodeinfo',
			proxy: config.proxy,
			timeout: 1000 * 10,
			forever: true,
			headers: {
				'User-Agent': config.userAgent,
				Accept: 'application/json, */*'
			},
			json: true
		}).catch(e => {
			if (e.statusCode === 404) {
				throw 'No nodeinfo provided';
			} else {
				throw e.statusCode || e.message;
			}
		});

		if (wellknown.links == null || !Array.isArray(wellknown.links)) {
			throw 'No wellknown links';
		}

		const links = wellknown.links as any[];

		const lnik1_0 = links.find(link => link.rel === 'http://nodeinfo.diaspora.software/ns/schema/1.0');
		const lnik2_0 = links.find(link => link.rel === 'http://nodeinfo.diaspora.software/ns/schema/2.0');
		const lnik2_1 = links.find(link => link.rel === 'http://nodeinfo.diaspora.software/ns/schema/2.1');
		const link = lnik2_1 || lnik2_0 || lnik1_0;

		if (link == null) {
			throw 'No nodeinfo link provided';
		}

		const info = await request({
			url: link.href,
			proxy: config.proxy,
			timeout: 1000 * 10,
			forever: true,
			headers: {
				'User-Agent': config.userAgent,
				Accept: 'application/json, */*'
			},
			json: true
		}).catch(e => {
			throw e.statusCode || e.message;
		});

		await server.setInstance(host, {
			infoUpdatedAt: new Date(),
			softwareName: info.software.name.toLowerCase(),
			softwareVersion: info.software.version,
			openRegistrations: info.openRegistrations,
			metadata: info.metadata,
			name: info.metadata ? (info.metadata.nodeName || info.metadata.name || null) : null,
			description: info.metadata ? (info.metadata.nodeDescription || info.metadata.description || null) : null,
			maintainerName: info.metadata ? info.metadata.maintainer ? (info.metadata.maintainer.name || null) : null : null,
			maintainerEmail: info.metadata ? info.metadata.maintainer ? (info.metadata.maintainer.email || null) : null : null,
		});

		logger.succ(`Successfuly fetched nodeinfo of ${host}`);
	} catch (e) {
		logger.error(`Failed to fetch nodeinfo of ${host}: ${e}`);

		await server.setInstance(host, {
			infoUpdatedAt: new Date(),
		});
	} finally {
		unlock();
	}
}
