import { User, Note, File, Following, Blocking } from './models';

type Maybe<T> = T | null | undefined;

export type DBTable<T extends { id: string; }> = {
	find: (query: Partial<T>) => Promise<T[]>;
	findOne: (query: T['id'] | Partial<T>) => Promise<Maybe<T>>;
};

export type DB = {
	users: DBTable<User>;
	notes: DBTable<Note>;
	files: DBTable<File>;
	followings: DBTable<Following>;
	blockings: DBTable<Blocking>;
};
