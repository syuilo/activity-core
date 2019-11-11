import { ApServer } from '../..';
import { RemoteUser, LocalUser } from '../../models';

//#region types
interface IRecipe {
	type: string;
}

interface IFollowersRecipe extends IRecipe {
	type: 'Followers';
}

interface IDirectRecipe extends IRecipe {
	type: 'Direct';
	to: RemoteUser;
}

const isFollowers = (recipe: any): recipe is IFollowersRecipe =>
	recipe.type === 'Followers';

const isDirect = (recipe: any): recipe is IDirectRecipe =>
	recipe.type === 'Direct';
//#endregion

export default class DeliverManager {
	private server: ApServer;
	private actor: LocalUser;
	private activity: any;
	private recipes: IRecipe[] = [];

	/**
	 * Constructor
	 * @param server instance of ApServer
	 * @param actor Actor
	 * @param activity Activity to deliver
	 */
	constructor(server: ApServer, actor: LocalUser, activity: any) {
		this.server = server;
		this.actor = actor;
		this.activity = activity;
	}

	/**
	 * Add recipe for followers deliver
	 */
	public addFollowersRecipe() {
		const deliver = {
			type: 'Followers'
		} as IFollowersRecipe;

		this.addRecipe(deliver);
	}

	/**
	 * Add recipe for direct deliver
	 * @param to To
	 */
	public addDirectRecipe(to: RemoteUser) {
		const recipe = {
			type: 'Direct',
			to
		} as IDirectRecipe;

		this.addRecipe(recipe);
	}

	/**
	 * Add recipe
	 * @param recipe Recipe
	 */
	public addRecipe(recipe: IRecipe) {
		this.recipes.push(recipe);
	}

	/**
	 * Execute delivers
	 */
	public async execute() {
		if (!Users.isLocalUser(this.actor)) return;

		const inboxes: string[] = [];

		// build inbox list
		for (const recipe of this.recipes) {
			if (isFollowers(recipe)) {
				// followers deliver
				const followers = await this.server.db.followings.find({
					followeeId: this.actor.id
				});

				for (const following of followers) {
					if (Followings.isRemoteFollower(following)) {
						const inbox = following.followerSharedInbox || following.followerInbox;
						if (!inboxes.includes(inbox)) inboxes.push(inbox);
					}
				}
			} else if (isDirect(recipe)) {
				// direct deliver
				const inbox = recipe.to.inbox;
				if (inbox && !inboxes.includes(inbox)) inboxes.push(inbox);
			}
		}

		// deliver
		for (const inbox of inboxes) {
			this.server.queue.deliver(this.actor, this.activity, inbox);
		}
	}
}

//#region Utilities
/**
 * Deliver activity to followers
 * @param activity Activity
 * @param from Followee
 */
export async function deliverToFollowers(actor: LocalUser, activity: any) {
	const manager = new DeliverManager(actor, activity);
	manager.addFollowersRecipe();
	await manager.execute();
}

/**
 * Deliver activity to user
 * @param activity Activity
 * @param to Target user
 */
export async function deliverToUser(actor: LocalUser, activity: any, to: RemoteUser) {
	const manager = new DeliverManager(actor, activity);
	manager.addDirectRecipe(to);
	await manager.execute();
}
//#endregion
