/**
 * Model type definitions
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
};

export type LocalUser = User & {
	host: null;
};

export type RemoteUser = User & {
	host: string;
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

export type Instance = {
	infoUpdatedAt: Date;
};
