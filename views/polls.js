const { commas, names } = require('../plugins/factory.js');

const list_polls = async ({ user, store, options={ filter: 'open' } }) => {
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
    )).sort({ opened: -1 });

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
                            text: `*Status:* ${poll.closed !== undefined ? 'open' : 'closed'}`
                        }] : []),
                        {
                            type: 'mrkdwn',
                            text: `*Audience:* <#${poll.audience}>`
                        },
                        ...(poll.votes[user] !== undefined ? [{
                            type: 'mrkdwn',
                            text: `*Your Vote:* ${poll.choices[poll.votes[user]]}`
                        }] : [])
                    ]
                },
                {
                    type: 'actions',
                    elements: [
                        ...(poll.choices.map((choice, index) =>
                            ({
                                type: 'button',
                                action_id: `vote_button_${index}_${
                                    poll.members.includes(user) ? (
                                        !poll.closed
                                            ? 'open'
                                            : 'closed'
                                    ) : 'nonmember'
                                }`,
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
                                ])
                            ],
                            confirm: {
                                title: {
                                    type: 'plain_text',
                                    text: 'Are you sure?'
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
                        ...(user != poll.host ? [
                            {
                                type: 'mrkdwn',
                                text: `*Members:* ${names(poll.members, user)}`
                            }
                        ] : [
                            ...(voted.length > 0 ? [{
                                type: 'mrkdwn',
                                text: `*Voted:* ${names(voted, user)}`
                            },] : []),
                            ...(unvoted.length > 0 ? [{
                                type: 'mrkdwn',
                                text: `*Not Voted:* ${names(unvoted, user)}`
                            }] : [])
                        ]),
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

const create_poll_modal = async ({ channel, context, client }) => {
    let users = channel ? (await client.conversations.members({
        token: context.botToken,
        channel: channel
    })).members.filter(user => user != context.botUserId) : [];

    let blocks = [
		{
            type: 'input',
            block_id: 'audience',
			label: {
				type: 'plain_text',
                text: ':loudspeaker: Audience',
                emoji: true
			},
			hint: {
				type: 'plain_text',
				text: 'The channel where the poll is announced.'
			},
			element: {
                type: 'channels_select',
                action_id: 'input',
				placeholder: {
					type: 'plain_text',
					text: 'Select a channel'
                },
                ...(channel ?{
                    initial_channel: channel
                } : {})
			}
        },
        {
            type: 'input',
            block_id: 'members',
			label: {
				type: 'plain_text',
                text: ':busts_in_silhouette: Members',
                emoji: true
			},
			hint: {
				type: 'plain_text',
				text: "The users who may participate in the poll (not restricted to the audience)."
			},
			element: {
                type: 'multi_users_select',
                action_id: 'input',
				placeholder: {
					type: 'plain_text',
					text: 'Select users'
                },
                initial_users: users
			}
		},
		{
            type: 'input',
            block_id: 'prompt',
			label: {
				type: 'plain_text',
                text: ':question: Prompt',
                emoji: true
			},
			hint: {
				type: 'plain_text',
				text: 'The question or statement that the members vote on (no formatting or emoji).'
			},
			element: {
                type: 'plain_text_input',
                action_id: 'input',
                placeholder: {
					type: 'plain_text',
					text: 'Question or statement'
                },
                min_length: 5,
                max_length: 300
			}
		},
		{
            type: 'input',
            block_id: 'choices',
			label: {
				type: 'plain_text',
                text: ':exclamation: Choices',
                emoji: true
			},
			hint: {
				type: 'plain_text',
				text: 'The choices that members vote for, one per line (no formatting, emoji okay).'
			},
			element: {
                type: 'plain_text_input',
                action_id: 'input',
				multiline: true,
                placeholder: {
					type: 'plain_text',
					text: 'One choice per line'
                },
                min_length: 5,
                max_length: 300
			}
		},
        {
            type: 'input',
			optional: true,
            block_id: 'setup',
			label: {
				type: 'plain_text',
				text: 'Setup'
			},
			element: {
                type: 'checkboxes',
                action_id: 'inputs',
				options: [
					{
						text: {
							type: 'plain_text',
                            text: ':bell: Participation Notices',
                            emoji: true
						},
						description: {
							type: 'plain_text',
							text: 'Announce each time a member votes or unvotes.'
						},
						value: 'participation'
					},
					{
						text: {
							type: 'plain_text',
                            text: ':bust_in_silhouette: Anonymous Voting',
                            emoji: true
						},
						description: {
							type: 'plain_text',
							text: 'Results show only tallies, not member names.'
						},
						value: 'anonymous'
					},
					{
						text: {
							type: 'plain_text',
                            text: ':hourglass_flowing_sand: Automatic Closing',
                            emoji: true
						},
						description: {
							type: 'plain_text',
							text: 'Closes automatically when all members have voted.'
						},
						value: 'autoclose'
					}
				]
			}
		}
	];

    let view = {
        type: 'modal',
        callback_id: 'create_poll_modal',
        title: {
          type: 'plain_text',
          text: 'Create a poll'
        },
        submit: {
          type: 'plain_text',
          text: 'Create'
        },
        close: {
          type: 'plain_text',
          text: 'Cancel'
        },
        blocks: blocks
    };

    return JSON.stringify(view);
};

module.exports = {
    list_polls,
    create_poll_modal
};
