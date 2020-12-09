import { ActionsBlock, Block, ContextBlock, DividerBlock, SectionBlock } from '@slack/web-api';
import { Cursor, MongoClient } from 'mongodb';
import { Cache } from '../app';
import { HomeTabs } from '../home';
import { commas, names } from '../library/factory';
import { Poll } from './polls';

const MAX_POLLS_SHOWN = 10;

export const tabs: HomeTabs = {
    'polls-open': {
        title: 'Polls \u2022 Open',
        emoji: ':ballot_box_with_ballot:'
    },
    'polls-closed': {
        title: 'Polls \u2022 Closed',
        emoji: ':ballot_box_with_ballot:'
    },
    'polls-all': {
        title: 'Polls \u2022 All',
        emoji: ':ballot_box_with_ballot:'
    }
};

export const blocks = async ({ user, store, cache }: { user: string; store: Promise<MongoClient>; cache: Cache }): Promise<Block[]> => {
    const tab = cache[user].home_tab ?? 'polls-open',
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
    const voted = poll.members.filter(member => poll.votes[member] !== undefined),
        unvoted = poll.members.filter(member => poll.votes[member] === undefined),
        tab = cache[user].home_tab ?? 'polls-open';

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
                    text: `*Audience:* <#${poll.audience}>`
                },
                ...poll.votes[user] !== undefined ? [{
                    type: 'mrkdwn',
                    text: `*You Voted:* ${poll.choices[poll.votes[user]]}`
                }] : [],
                ...poll.latest ? [{
                    type: 'mrkdwn',
                    text: `*Latest:* ${poll.latest.summary} <!date^${parseInt(poll.latest.message_ts)}^{date_short_pretty} at {time}^${poll.latest.permalink}|there>`
                }] : []
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
                                    text: 'Reannounce Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'reannounce'
                                })
                            }
                            // TODO edit with "edited" warning
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
                {
                    type: 'mrkdwn',
                    text: `*Host:* ${poll.host != user ? `<@${poll.host}>` : 'you'}`
                },
                // TODO display results instead if poll is closed
                ...user == poll.host ? [
                    ...voted.length > 0 ? [{
                        type: 'mrkdwn',
                        text: `*Voted:* ${names(voted, user)}`
                    },] : [],
                    ...unvoted.length > 0 ? [{
                        type: 'mrkdwn',
                        text: `*Not Voted:* ${names(unvoted, user)}`
                    }] : []
                ] : [{
                    type: 'mrkdwn',
                    text: `*Members:* ${names(poll.members, user)}`
                }],
                {
                    type: 'mrkdwn',
                    text: `*About:* ${commas([
                        {
                            'anonymous': 'anonymous poll',
                            'simultaneous': 'simultaneous poll',
                            'live': 'live poll'
                        }[poll.method],
                        poll.autoclose ? 'autoclose' : undefined
                    ])}`
                }
            ]
        }
    ];

    return blocks;
};
