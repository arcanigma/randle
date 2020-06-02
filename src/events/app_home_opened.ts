import { App } from '@slack/bolt';
import { MongoClient } from 'mongodb';

import app_home from '../views/app_home';

export default (app: App, store: Promise<MongoClient>): void => {
    app.event('app_home_opened', async ({ event, context, client }) => {
        const user = event.user;

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: await app_home(user, store)
        });
    });
};
