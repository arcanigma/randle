import { App, BlockAction, StaticSelectAction } from '@slack/bolt';
import { SectionBlock, View } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import { Cache, MAX_VIEW_BLOCKS } from './app';
import * as macros from './macros/macros_home';
import * as polls from './polls/polls_home';

export type HomeTabs = {
    [shortcode: string]: {
        title: string;
        emoji?: string;
    };
}

const HOME_TABS = Object.assign({},
    macros.tabs,
    polls.tabs
);

const DEFAULT_TAB = 'macros-user';

export const view = async ({ user, store, cache }: { user: string; store: Promise<MongoClient>; cache: Cache }): Promise<View> => {
    if (cache[user] === undefined)
        cache[user] = {};

    if (cache[user].tab === undefined)
        cache[user].tab = DEFAULT_TAB;

    const tab = cache[user].tab ?? DEFAULT_TAB;

    const view: View = {
        type: 'home',
        blocks: [
            <SectionBlock> {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `${HOME_TABS[tab].emoji ?? '>>>'} *${HOME_TABS[tab].title}*`
                },
                accessory: {
                    type: 'static_select',
                    action_id: 'home_tab_select',
                    placeholder: {
                        type: 'plain_text',
                        text: 'Tabs'
                    },
                    initial_option: {
                        text: {
                            type: 'plain_text',
                            text: HOME_TABS[tab].title
                        },
                        value: tab
                    },
                    options: Object.keys(HOME_TABS).map(tab => ({
                        text: {
                            type: 'plain_text',
                            text: HOME_TABS[tab].title
                        },
                        value: tab
                    }))
                }
            }
        ]
    };

    if (tab.startsWith('macros'))
        view.blocks.push(...await macros.blocks({ user, store }));
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
            view: await view({ user, store, cache })
        });
    });

    app.action<BlockAction<StaticSelectAction>>('home_tab_select', async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id,
            tab = action.selected_option.value;

        cache[user].tab = tab;

        await client.views.publish({
            token: <string> context.botToken,
            user_id: user,
            view: await view({ user, store, cache })
        });
    });
};
