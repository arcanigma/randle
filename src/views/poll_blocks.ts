import { Block, SectionBlock, ActionsBlock, ContextBlock } from '@slack/web-api';

import { commas, names } from '../library/factory';
import { Poll, PollSetupOptions } from '../components/polls';
import { HomeOptions, PollFilterOptions } from '../views/app_home';

export default async (user: string, poll: Poll, options: HomeOptions): Promise<Block[]> => {
    const voted = poll.members.filter(member => poll.votes[member] !== undefined),
        unvoted = poll.members.filter(member => poll.votes[member] === undefined);

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
                ...(options.polls.filter == PollFilterOptions.All ? [{
                    type: 'mrkdwn',
                    text: `*Status:* ${poll.closed !== undefined ? 'closed' : 'open'}`
                }] : []),
                {
                    type: 'mrkdwn',
                    text: `*Audience:* <#${poll.audience}>`
                },
                ...(poll.votes[user] !== undefined ? [{
                    type: 'mrkdwn',
                    text: `*You Voted:* ${poll.choices[poll.votes[user]]}`
                }] : []),
                ...(poll.latest ? [{
                    type: 'mrkdwn',
                    text: `*Latest:* ${poll.latest.summary} <!date^${parseInt(poll.latest.message_ts)}^{date_short_pretty} at {time}^${poll.latest.permalink}|for the audience>`
                }] : [])
            ]
        },
        <ActionsBlock>{
            type: 'actions',
            elements: [
                ...(poll.choices.map((choice, index) =>
                    ({
                        type: 'button',
                        action_id: `vote_button_${index}`,
                        text: {
                            type: 'plain_text',
                            emoji: true,
                            text: choice
                        },
                        ...(poll.votes[user] === index ? {
                            style: !poll.closed ? 'primary' : 'danger'
                        } : !poll.members.includes(user) ? {
                            style: 'danger'
                        } : {}),
                        value: JSON.stringify({
                            poll: poll._id,
                            choice: poll.votes[user] != index ? index : null
                        })
                    })
                )),
                ...(poll.host == user ? [{
                    type: 'overflow',
                    action_id: 'poll_overflow_button',
                    options: [
                        ...(!poll.closed ? [
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
                        ]),
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
                }] : [])
            ]
        },
        <ContextBlock>{
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `*Host:* ${poll.host != user ? `<@${poll.host}>` : 'you'}`
                },
                ...(user == poll.host || poll.setup.includes(PollSetupOptions.Participation) ? [
                    ...(voted.length > 0 ? [{
                        type: 'mrkdwn',
                        text: `*Voted:* ${names(voted, user)}`
                    },] : []),
                    ...(unvoted.length > 0 ? [{
                        type: 'mrkdwn',
                        text: `*Not Voted:* ${names(unvoted, user)}`
                    }] : [])
                ] : [{
                    type: 'mrkdwn',
                    text: `*Members:* ${names(poll.members, user)}`
                }]),
                ...(poll.setup ? [{
                    type: 'mrkdwn',
                    text: `*Setup:* ${commas(poll.setup.map(option => ({
                        participation: 'participation notices',
                        anonymous: 'anonymous voting',
                        autoclose: 'automatic closing'
                    })[option])) || 'default'}`
                }] : [])
            ]
        }
    ];

    return blocks;
};
