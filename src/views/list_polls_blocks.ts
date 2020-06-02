import { Block, SectionBlock, ContextBlock, DividerBlock } from '@slack/web-api';
import { MongoClient, Cursor } from 'mongodb';

import { Poll } from '../components/polls';
import { HomeOptions, PollFilterOptions } from '../views/app_home';

import poll_blocks from '../views/poll_blocks';

export default async (user: string, store: Promise<MongoClient>, options: HomeOptions): Promise<Block[]> => {
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
                ...await poll_blocks(user, poll, options)
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
