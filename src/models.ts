/**
 * Model type definitions
 * and related functions
 */

export type User = {
	id: string;
	username: string;
	host: string | null;
	uri: string | null;
	name: string | null;
	avatarId: File['id'];
	bannerId: File['id'];
	tags: string[];
	isBot: boolean;
	isLocked: boolean;
	inbox: string | null;
};

export type LocalUser = User & {
	host: null;
	inbox: null;
};

export type RemoteUser = User & {
	host: string;
	inbox: string;
};

export type UserProfile = {
	description: string;
	fields: { name: string; value: string; }[];
};

export type UserKeypair = {
	publicKey: string;
};

export type Note = {
	id: string;
	uri: string | null;
	visibility: 'public' | 'home' | 'followers' | 'specified';
	userHost: User['host'];
	tags: string[];
};

export type File = {
	id: string;
};

export type Following = {
	id: string;
	followerId: User['id'];
	followeeId: User['id'];
};

export type Blocking = {
	id: string;
	blockerId: User['id'];
	blockeeId: User['id'];
};

export type Instance = {
	infoUpdatedAt: Date;
};

export function isLocalUser(user: User): user is LocalUser {
	return user.host === null;
}

export function isRemoteUser(user: User): user is RemoteUser {
	return !isLocalUser(user);
}
