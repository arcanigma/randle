import { App } from '@slack/bolt';
import { Block, View } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import { MAX_VIEW_BLOCKS } from './app.js';
import * as macros from './macros/macros_home';
import * as polls from './polls/polls_home';

/* TODO 100 block error

    selection menu:
        open polls
        closed polls
        all polls
        macros
    remember selection
*/

export type HomeOptions = {
    polls: {
        filter: PollFilterOptions;
    };
};

export enum PollFilterOptions {
    Open = 'open',
    Closed = 'closed',
    All = 'all'
}

export const view = async (user: string, store: Promise<MongoClient>, options?: HomeOptions): Promise<View> => ({
    type: 'home',
    blocks: [
        ...await polls.blocks(user, store, options ?? { polls: { filter: PollFilterOptions.Open }}),
        { type: 'divider' },
        ...await macros.blocks(user, store),
        { type: 'divider' }
    ].slice(0, MAX_VIEW_BLOCKS) as Block[]
});

export const events = (app: App, store: Promise<MongoClient>): void => {
    app.event('app_home_opened', async ({ event, context, client }) => {
        const user = event.user;

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: await view(user, store)
        });
    });
};
