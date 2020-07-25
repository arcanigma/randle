import { App, StaticSelectAction } from '@slack/bolt';
import { Block, ContextBlock, DividerBlock, SectionBlock } from '@slack/web-api';
import { Cursor, MongoClient } from 'mongodb';
import * as home from '../home';
import { HomeOptions, PollFilterOptions } from '../home';
import { Poll } from './polls';
import * as poll_blocks from './poll_blocks';

export const blocks = async (user: string, store: Promise<MongoClient>, options: HomeOptions): Promise<Block[]> => {
    const blocks: Block[] = [];

    blocks.push(...[
        <SectionBlock>{
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '>>> *Polls*'
            },
            accessory: {
                type: 'static_select',
                action_id: 'filter_polls_select',
                placeholder: {
                    type: 'plain_text',
                    text: 'Filter Polls'
                },
                initial_option: {
                    text: {
                        type: 'plain_text',
                        text: {
                            [PollFilterOptions.Open]: 'Open Polls',
                            [PollFilterOptions.Closed]: 'Closed Polls',
                            [PollFilterOptions.All]: 'All Polls'
                        }[options.polls.filter]
                    },
                    value: options.polls.filter
                },
                options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Open Polls'
                        },
                        value: PollFilterOptions.Open
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Closed Polls'
                        },
                        value: PollFilterOptions.Closed
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'All Polls'
                        },
                        value: PollFilterOptions.All
                    }
                ]
            }
        }
    ]);

    // TODO limit number of polls returned
    const coll = (await store).db().collection('polls');
    const polls: Cursor<Poll> = (await coll.find({
        ...(options.polls.filter != PollFilterOptions.All ? {
            closed: { $exists: options.polls.filter == PollFilterOptions.Closed }
        } : {}),
        $or: [
            { host: user },
            { members: { $in: [user] } }
        ]
    })).sort(
        options.polls.filter != PollFilterOptions.Closed
        ? { opened: -1 }
        : { closed: -1 }
    );

    if (await polls.count() > 0) {
        await polls.forEach(async (poll) => {
            blocks.push(...[
                <DividerBlock>{ type: 'divider' },
                ...await poll_blocks.blocks(user, poll, options)
            ]);
        });
    }
    else {
        blocks.push(...[
            <DividerBlock>{ type: 'divider' },
            <ContextBlock>{
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: `You aren't a host or member of ${{
                            [PollFilterOptions.Open]: 'any *open*',
                            [PollFilterOptions.Closed]: 'any *closed*',
                            [PollFilterOptions.All]: '*any*'
                        }[options.polls.filter]} polls.`
                    }
                ]
            }
        ]);
    }

    return blocks;
};

export const events = (app: App, store: Promise<MongoClient>):void  => {
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
            view: await home.view(user, store, options)
        });
    });
};
