import { Block, ContextBlock, DividerBlock, SectionBlock } from '@slack/web-api';
import { MongoClient } from 'mongodb';

export const blocks = async (user: string, store: Promise<MongoClient>): Promise<Block[]> => {
    const blocks: Block[] = [];

    blocks.push(...[
        <SectionBlock>{
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '>>> *Macros*'
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
    ]);

    const coll = (await store).db().collection('macros');
    const macros = (await coll.findOne(
        { _id: user },
        { projection: { _id: 0} }
    ));

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
