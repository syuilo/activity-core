import { User, Note, File, Following, Blocking, Emoji } from './models';

type Maybe<T> = T | null | undefined;

export type DBTable<T extends { id: string; }> = {
	find: (query: Partial<T>) => Promise<T[]>;
	findOne: (query: T['id'] | Partial<T>) => Promise<Maybe<T>>;
	save: (fields: Partial<T>) => Promise<T>;
	update: (query: T['id'] | Partial<T>, fields: Partial<T>) => Promise<void>;
};

export type DB = {
	users: DBTable<User>;
	notes: DBTable<Note>;
	files: DBTable<File>;
	emojis: DBTable<Emoji>;
	followings: DBTable<Following>;
	blockings: DBTable<Blocking>;
};
