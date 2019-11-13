/**
 * Model type definitions
 * and related functions
 */

export type User = {
	id: string;
	createdAt: Date;
	lastFetchedAt: Date;
	username: string;
	usernameLower: string;
	host: string | null;
	uri: string | null;
	name: string | null;
	avatarId: File['id'] | null;
	bannerId: File['id'] | null;
	tags: string[];
	isBot: boolean;
	isLocked: boolean;
	isSuspended: boolean;
	inbox: string | null;
	sharedInbox: string | null;
	featured: string | null;
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
	url: string | null;
	userHost: string | null;
};

export type UserPublickey = {
	keyId: string;
	keyPem: string;
};

export type UserKeypair = {
	publicKey: string;
	privateKey: string;
};

export type Note = {
	id: string;
	uri: string | null;
	visibility: 'public' | 'home' | 'followers' | 'specified';
	userHost: User['host'];
	text: string | null;
	renoteId: Note['id'] | null;
	tags: string[];
};

export type File = {
	id: string;
};

export type Following = {
	id: string;
	followerId: User['id'];
	followeeId: User['id'];
	followerHost: string | null;
	followeeHost: string | null;
	followerInbox: string | null;
	followerSharedInbox: string | null;
	followeeInbox: string | null;
	followeeSharedInbox: string | null;
};

type LocalFollowerFollowing = Following & {
	followerHost: null;
	followerInbox: null;
	followerSharedInbox: null;
};

type RemoteFollowerFollowing = Following & {
	followerHost: string;
	followerInbox: string;
	followerSharedInbox: string;
};

type LocalFolloweeFollowing = Following & {
	followeeHost: null;
	followeeInbox: null;
	followeeSharedInbox: null;
};

type RemoteFolloweeFollowing = Following & {
	followeeHost: string;
	followeeInbox: string;
	followeeSharedInbox: string;
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

export function isLocalFollower(following: Following): following is LocalFollowerFollowing {
	return following.followerHost == null;
}

export function isRemoteFollower(following: Following): following is RemoteFollowerFollowing {
	return following.followerHost != null;
}

export function isLocalFollowee(following: Following): following is LocalFolloweeFollowing {
	return following.followeeHost == null;
}

export function isRemoteFollowee(following: Following): following is RemoteFolloweeFollowing {
	return following.followeeHost != null;
}
