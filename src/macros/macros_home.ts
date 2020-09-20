import { Block, ContextBlock, DividerBlock, SectionBlock } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import { HomeTabs } from '../home';

export const tabs: HomeTabs = {
    'macros-user': {
        title: 'Macros \u2022 Personal',
        emoji: ':game_die:'
    },

    // TODO read workspace macros
    // TODO edit workspace macros if super user
    // 'macros-workspace': {
    //     title: 'Macros \u2022 Community',
    //     emoji: ':game_die:'
    // }
};

export const blocks = async ({ user, store }: { user: string; store: Promise<MongoClient> }): Promise<Block[]> => {
    const blocks: Block[] = [
        <DividerBlock>{ type: 'divider' },
        <SectionBlock>{
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '*Personal*'
            },
            accessory: {
                type: 'button',
                action_id: 'edit_macro_button',
                text: {
                    type: 'plain_text',
                    text: 'Create'
                }
            }
        },
        <DividerBlock>{ type: 'divider' }
    ];

    const coll = (await store).db().collection('macros');
    const macros = await coll.findOne(
        { _id: user },
        { projection: { _id: 0 } }
    ) as {
        [macro: string]: string;
    };

    if (macros) {
        const names = Object.keys(macros).sort();

        for (const name of names) {
            blocks.push(<SectionBlock>{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*\`${name}\`* \u2022 ${macros[name]}`
                },
                accessory: {
                    type: 'button',
                    action_id: 'edit_macro_button',
                    text: {
                        type: 'plain_text',
                        text: 'Edit'
                    },
                    value: name
                }
            });
        }
    }
    else {
        blocks.push(<ContextBlock>{
            type: 'context',
            elements: [
                {
                    type: 'plain_text',
                    text: 'You have no macros.'
                }
            ]
        });
    }

    return blocks;
};
