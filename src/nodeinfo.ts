export type Nodeinfo = {
	software: {
		name: string;
		version: string;
		repository: string;
	};
	protocols: string[];
	services: {
		inbound: string[];
		outbound: string[];
	};
	openRegistrations: boolean;
	usage: {
		users: {};
	};
	metadata: Record<string, any>;
};
