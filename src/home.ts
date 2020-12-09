import { App, BlockAction, Context, StaticSelectAction } from '@slack/bolt';
import { ActionsBlock, View } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import { Cache, MAX_VIEW_BLOCKS } from './app';
import * as macros from './macros/macros_home';
import * as polls from './polls/polls_home';

export type HomeTabs = {
    [shortcode: string]: {
        title: string;
        emoji: string;
    };
}

const HOME_TABS = Object.assign({},
    macros.tabs,
    polls.tabs
);

const DEFAULT_TAB = 'macros-user';

export const view = async ({ user, store, cache, context }: { user: string; store: Promise<MongoClient>; cache: Cache; context: Context }): Promise<View> => {
    const tab = <string>cache[`${user}/home_tab`] ?? DEFAULT_TAB;

    const view: View = {
        type: 'home',
        blocks: [
            <ActionsBlock> {
                type: 'actions',
                elements: [{
                    type: 'static_select',
                    action_id: 'home_tab_select',
                    placeholder: {
                        type: 'plain_text',
                        text: 'Tabs'
                    },
                    initial_option: {
                        text: {
                            type: 'plain_text',
                            text: `${HOME_TABS[tab].emoji} ${HOME_TABS[tab].title}`
                        },
                        value: tab
                    },
                    options: Object.keys(HOME_TABS).map(tab => ({
                        text: {
                            type: 'plain_text',
                            emoji: true,
                            text: `${HOME_TABS[tab].emoji} ${HOME_TABS[tab].title}`
                        },
                        value: tab
                    }))
                }]
            }
        ]
    };

    if (tab.startsWith('macros'))
        view.blocks.push(...await macros.blocks({ user, store, cache, context }));
    else if (tab.startsWith('polls'))
        view.blocks.push(...await polls.blocks({ user, store, cache }));

    // TODO better 100 block limit
    view.blocks = view.blocks.slice(0, MAX_VIEW_BLOCKS);

    return view;
};

export const register = ({ app, store, cache }: { app: App; store: Promise<MongoClient>; cache: Cache }): void => {
    app.event('app_home_opened', async ({ event, context, client }) => {
        const user = event.user;

        await client.views.publish({
            token: <string> context.botToken,
            user_id: user,
            view: await view({ user, store, cache, context })
        });
    });

    app.action<BlockAction<StaticSelectAction>>('home_tab_select', async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id,
            tab = action.selected_option.value;

        cache[`${user}/home_tab`] = tab;

        await client.views.publish({
            token: <string> context.botToken,
            user_id: user,
            view: await view({ user, store, cache, context })
        });
    });
};
