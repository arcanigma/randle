import { ActionsBlock, Block, ContextBlock, DividerBlock, SectionBlock } from '@slack/web-api';
import { Cursor, MongoClient } from 'mongodb';
import { Cache } from '../app';
import { HomeTabs } from '../home';
import { fallback_date } from '../library/factory';
import { Poll, poll_about, poll_cohorts, poll_not_voted, poll_voted } from './polls';

const MAX_POLLS_SHOWN = 10;

export const tabs: HomeTabs = {
    'polls-open': {
        title: 'Open Polls',
        emoji: ':ballot_box_with_ballot:'
    },
    'polls-closed': {
        title: 'Closed Polls',
        emoji: ':ballot_box_with_ballot:'
    },
    'polls-all': {
        title: 'All Polls',
        emoji: ':ballot_box_with_ballot:'
    }
};

export const blocks = async ({ user, store, cache }: { user: string; store: Promise<MongoClient>; cache: Cache }): Promise<Block[]> => {
    const tab = cache[`${user}/home_tab`] ?? 'polls-open',
        blocks: Block[] = [];

    const coll = (await store).db().collection('polls');
    const polls = <Cursor<Poll>> coll.find({
        ...tab != 'polls-all' ? {
            closed: { $exists: tab == 'polls-closed' }
        } : {},
        $or: [
            { host: user },
            { members: { $in: [user] } }
        ]
    }).sort(
        tab != 'polls-closed'
            ? { opened: -1 }
            : { closed: -1 }
    ).limit(MAX_POLLS_SHOWN);

    if (await polls.count() > 0) {
        await polls.forEach((poll) => {
            blocks.push(
                <DividerBlock>{ type: 'divider' },
                ...poll_blocks({ user, poll, cache })
            );
        });
    }
    else {
        blocks.push(...[
            <DividerBlock>{ type: 'divider' },
            <SectionBlock>{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `You aren't a host or member of ${
                        tab == 'polls-open' ?
                            'any *open*' :
                            tab == 'polls-closed' ?
                                'any *closed*' :
                                '*any*'
                    } polls.`
                }
            }
        ]);
    }

    return blocks;
};

const poll_blocks = ({ user, poll, cache }: { user: string; poll: Poll; cache: Cache }): Block[] => {
    const tab = cache[`${user}/home_tab`] ?? 'polls-open';

    const blocks: Block[] = [
        <SectionBlock>{
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${poll.prompt}*`
            }
        },
        <ContextBlock>{
            type: 'context',
            elements: [
                ...tab == 'polls-all' ? [{
                    type: 'mrkdwn',
                    text: `*Status:* ${poll.closed !== undefined ? 'closed' : 'open'}`
                }] : [],
                {
                    type: 'mrkdwn',
                    text: `*Host:* ${poll.host != user ? `<@${poll.host}>` : 'you'}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Audience:* <#${poll.audience}>`
                },
                ...poll_about(poll),
                ...(poll.votes[user] !== undefined ? [{
                    type: 'mrkdwn',
                    text: `*You Voted For:* ${poll.choices[poll.votes[user]]}`
                }] : []),
                ...(poll.latest ? [{
                    type: 'mrkdwn',
                    text: `*Latest:* <!date^${parseInt(poll.latest.message_ts)}^{date_short_pretty} at {time}^${poll.latest.permalink}|${fallback_date(poll.latest.message_ts)}> ${poll.latest.summary}`
                }] : [])
            ]
        },
        <ActionsBlock>{
            type: 'actions',
            elements: [
                ...poll.choices.map((choice, index) =>
                    ({
                        type: 'button',
                        action_id: `vote_button_${index}`,
                        text: {
                            type: 'plain_text',
                            emoji: true,
                            text: choice
                        },
                        ...poll.votes[user] === index ? {
                            style: !poll.closed ? 'primary' : 'danger'
                        } : !poll.members.includes(user) ? {
                            style: 'danger'
                        } : {},
                        value: JSON.stringify({
                            poll: poll._id,
                            choice: poll.votes[user] != index ? index : null
                        })
                    })
                ),
                ...poll.host == user ? [{
                    type: 'overflow',
                    action_id: 'poll_overflow_button',
                    options: [
                        ...!poll.closed ? [
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Close Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'close'
                                })
                            },
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Abort Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'abort'
                                })
                            },
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Edit Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'edit'
                                })
                            },
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Reannounce Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'reannounce'
                                })
                            }
                        ] : [
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Reopen Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'reopen'
                                })
                            },
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Delete Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'delete'
                                })
                            }
                        ],
                    ],
                    confirm: {
                        title: {
                            type: 'plain_text',
                            text: 'Warning'
                        },
                        text: {
                            type: 'plain_text',
                            text: 'You might not be able to change your mind later.'
                        },
                        confirm: {
                            type:'plain_text',
                            text:'Proceed'
                        },
                        deny: {
                            type:'plain_text',
                            text:'Cancel'
                        }
                    }
                }] : []
            ]
        },
        <ContextBlock>{
            type: 'context',
            elements: [
                ...(poll.method == 'live' ? poll_cohorts : poll_voted)(poll, true),
                ...poll_not_voted(poll, true)
            ]
        }
    ];

    return blocks;
};
