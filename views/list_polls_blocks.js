const poll_blocks = require('./poll_blocks.js');

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
            blocks.push({ type: 'divider' });
            blocks.push(
                ...poll_blocks({ user, poll, options })
            );
        });
    }
    else {
        blocks.push({ type: 'divider' });
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
