import { App, StaticSelectAction } from '@slack/bolt';
import { MongoClient } from 'mongodb';

import { HomeOptions, PollFilterOptions } from '../views/app_home';

import app_home from '../views/app_home';

export default (app: App, store: Promise<MongoClient>):void  => {
    app.action('filter_polls_select', async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id,
            filter = (action as StaticSelectAction).selected_option.value;

        const options: HomeOptions = {
            polls: {
                filter: <PollFilterOptions>filter
            }
        };

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: await app_home(user, store, options)
        });
    });
};
