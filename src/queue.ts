export type Queue = {
	inbox: () => void;
	deliver: (actor, activity, inbox: string) => void;
};
