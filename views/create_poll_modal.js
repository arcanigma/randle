module.exports = async ({ channel, context, client }) => {
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
				text: "The users who can participate (not restricted to the audience)."
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
				text: 'The question or statement members vote on (no formatting, emoji okay).'
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
				text: 'The choices members vote for (one per line, no formatting, emoji okay).'
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
