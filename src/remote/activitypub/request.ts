import * as https from 'https';
import { sign } from 'http-signature';
import * as crypto from 'crypto';
import * as cache from 'lookup-dns-cache';

import config from '../../config';
import { LocalUser } from '../../models/entities/user';
import { publishApLogStream } from '../../services/stream';
import { UserKeypairs } from '../../models';
import { ensure } from '../../prelude/ensure';
import * as httpsProxyAgent from 'https-proxy-agent';

const agent = config.proxy
	? new httpsProxyAgent(config.proxy)
	: new https.Agent({
			lookup: cache.lookup,
		});

export default async (user: LocalUser, url: string, object: any) => {
	const timeout = 10 * 1000;

	const { protocol, hostname, port, pathname, search } = new URL(url);

	const data = JSON.stringify(object);

	const sha256 = crypto.createHash('sha256');
	sha256.update(data);
	const hash = sha256.digest('base64');

	const keypair = await UserKeypairs.findOne({
		userId: user.id
	}).then(ensure);

	await new Promise((resolve, reject) => {
		const req = https.request({
			agent,
			protocol,
			hostname,
			port,
			method: 'POST',
			path: pathname + search,
			timeout,
			headers: {
				'User-Agent': config.userAgent,
				'Content-Type': 'application/activity+json',
				'Digest': `SHA-256=${hash}`
			}
		}, res => {
			if (res.statusCode! >= 400) {
				reject(res);
			} else {
				resolve();
			}
		});

		sign(req, {
			authorizationHeaderName: 'Signature',
			key: keypair.privateKey,
			keyId: `${config.url}/users/${user.id}/publickey`,
			headers: ['date', 'host', 'digest']
		});

		// Signature: Signature ... => Signature: ...
		let sig = req.getHeader('Signature')!.toString();
		sig = sig.replace(/^Signature /, '');
		req.setHeader('Signature', sig);

		req.on('timeout', () => req.abort());

		req.on('error', e => {
			if (req.aborted) reject('timeout');
			reject(e);
		});

		req.end(data);
	});

	//#region Log
	publishApLogStream({
		direction: 'out',
		activity: object.type,
		host: null,
		actor: user.username
	});
	//#endregion
};
