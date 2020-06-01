const { commas, names } = require('../library/factory.js');

module.exports = async ({ user, store, options={ filter: 'open' } }) => {
    let blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `>>> *Polls*`
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
                            'open': 'Open Polls',
                            'closed': 'Closed Polls',
                            'all': 'All Polls'
                        }[options.filter]
                    },
                    value: options.filter
                },
                options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Open Polls'
                        },
                        value: 'open'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Closed Polls'
                        },
                        value: 'closed'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'All Polls'
                        },
                        value: 'all'
                    }
                ]
            }
        }
    ];

    let coll = (await store).db().collection('polls');
    let polls = (await coll.find(
        {
            ...(options.filter != 'all' ? {
                closed: { $exists: options.filter == 'closed' }
            } : {}),
            $or: [
                { host: user },
                { members: { $in: [user] } }
            ]
        }
    )).sort(
        options.filter != 'closed'
        ? { opened: -1 }
        : { closed: -1 }
    );

    if (await polls.count() > 0) {
        await polls.forEach((poll) => {
            let voted = poll.members.filter(member => poll.votes[member] !== undefined),
                unvoted = poll.members.filter(member => poll.votes[member] === undefined);

            blocks.push(
                {
                    type: 'divider'
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*${poll.prompt}*`
                    }
                },
                {
                    type: 'context',
                    elements: [
                        ...(options.filter == 'all' ? [{
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
                            text: `*Latest:* ${poll.latest.summary} <!date^${Math.trunc(poll.latest.message_ts)}^{date_short_pretty} at {time}^${poll.latest.permalink}|for the audience>`
                        }] : [])
                    ]
                },
                {
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
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `*Host:* ${poll.host != user ? `<@${poll.host}>` : 'you'}`
                        },
                        ...(user == poll.host || poll.setup.includes('participation') ? [
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
                            })[option]))}`
                        }] : [])
                    ]
                },
            );
        });
    }
    else {
        blocks.push({
            type: 'divider'
        });
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `You aren't a host or member of ${{
                        'open': 'any *open*',
                        'closed': 'any *closed*',
                        'all': '*any*'
                    }[options.filter]} polls.`
                }
            ]
        });
    }

    return blocks;
};
