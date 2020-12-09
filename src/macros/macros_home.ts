import { Context } from '@slack/bolt';
import { Block, DividerBlock, SectionBlock } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import { Cache } from '../app';
import { HomeTabs } from '../home';

export const tabs: HomeTabs = {
    'macros-user': {
        title: 'Your Macros',
        emoji: ':gear:'
    },
    'macros-workspace': {
        title: 'Shared Macros',
        emoji: ':gear:'
    }
};

export const blocks = async ({ user, store, cache, context }: { user: string; store: Promise<MongoClient>; cache: Cache; context: Context }): Promise<Block[]> => {
    const tab = cache[`${user}/home_tab`] ?? 'macros-user';

    const coll = (await store).db().collection('macros');
    const macros = await coll.findOne(
        { _id:
            tab == 'macros-user' ? user :
                tab == 'macros-workspace' ? <string> context.botUserId :
                    undefined },
        { projection: { _id: 0 } }
    ) as {
        [macro: string]: string;
    };

    const count = macros ? Object.keys(macros).length: 0;

    const blocks: Block[] = [
        <DividerBlock>{ type: 'divider' },
        <SectionBlock>{
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: tab == 'macros-user' ? `You have *${count}* personal macro${count != 1 ? 's' : ''}.` :
                    tab == 'macros-workspace' ? `The community has *${count}* shared macro${count != 1 ? 's' : ''}.` :
                        'Unknown macro type.'
            },
            // TODO edit workspace macros if super user
            ...(tab == 'macros-user' ? { accessory: {
                type: 'button',
                action_id: 'edit_macro_button',
                style: 'primary',
                text: {
                    type: 'plain_text',
                    text: 'Create'
                }
            } } : {})
        },
        <DividerBlock>{ type: 'divider' },
    ];

    if (macros) {
        const names = Object.keys(macros).sort();

        for (const name of names) {
            blocks.push(<SectionBlock>{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*\`${name}\`* \u2022 ${macros[name]}`
                },
                ...(tab == 'macros-user' ? { accessory: {
                    type: 'button',
                    action_id: 'edit_macro_button',
                    text: {
                        type: 'plain_text',
                        text: 'Edit'
                    },
                    value: name
                } } : {} )
            });
        }
    }

    return blocks;
};
