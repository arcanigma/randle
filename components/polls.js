const { ObjectID } = require('mongodb');

const { commas, names, onbox, offbox } = require('../library/factory.js'),
      informative_modal = require('../views/informative_modal.js');

module.exports = ({ app, store }) => {
    const timers = {};

    const announce = async ({ context, body, poll, client, mode }) => {
        let user = body.user.id,
            voted = poll.members.filter(member => poll.votes[member] !== undefined),
            unvoted = poll.members.filter(member => poll.votes[member] === undefined);

        let summary,
            blocks = [];

        if (mode == 'open' || mode == 'reopen' || mode == 'reannounce') {
            summary = `<@${poll.host}> ${{
                open: 'opened',
                reopen: 'reopened',
                reannounce: 'reannounced'
            }[mode]} the poll`;

            blocks.push({
                type: 'actions',
                elements: poll.choices.map((choice, index) =>
                    ({
                        type: 'button',
                        action_id: `vote_button_${index}`,
                        text: {
                            type: 'plain_text',
                            emoji: true,
                            text: choice
                        },
                        url: `slack://app?team=${body.team.id}&id=${body.api_app_id}&tab=home`,
                        value: JSON.stringify({
                            poll: poll._id,
                            choice: index
                        })
                    })
                )
            });

            blocks.push({
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: `*Members:* ${names(poll.members)}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Setup:* ${commas(poll.setup.map(option => ({
                            participation: 'participation notices',
                            anonymous: 'anonymous voting',
                            autoclose: 'automatic closing'
                        })[option]))}`
                    }
                ]
            });
        }
        else if (mode == 'participate') {
            summary = `<@${user}> ${poll.votes[user] !== undefined ? 'voted' : 'unvoted'}`;

            let counts = [];
            if (voted.length > 0)
                counts.push({
                    type: 'mrkdwn',
                    text: `*Voted:* ${onbox(voted.length)} *${voted.length}* (${names(voted)})`
                });
            if (unvoted.length > 0)
                counts.push({
                    type: 'mrkdwn',
                    text: `*Not Voted:* ${offbox(unvoted.length)} *${unvoted.length}* (${names(unvoted)})`
                });
            if (counts.length > 0)
                blocks.push({
                    type: 'context',
                    elements: counts
                });
        }
        else if (mode == 'close' || mode == 'autoclose') {
            summary = mode == 'close'
                ? `<@${poll.host}> closed the poll`
                : `<@${context.botUserId}> closed the poll for <@${poll.host}>`;

            blocks.push({
                type: 'context',
                elements: poll.choices.map((choice, index) => {
                    let cohort = poll.members.filter(member => poll.votes[member] === index);
                    return cohort.length > 0 ? {
                        type: 'mrkdwn',
                        text: `*${choice}:* ${onbox(cohort.length)} *${cohort.length}*${!poll.setup.includes('anonymous') ? ` (${names(cohort)})` : ''}`
                    } : undefined;
                }).filter(element => element !== undefined)
            });

            let counts = [];
            if (poll.setup.includes('anonymous') && voted.length > 0)
                counts.push({
                    type: 'mrkdwn',
                    text: `*Voted Anonymously:* *${voted.length}* (${names(voted)})`
                });
            if (unvoted.length > 0)
                counts.push({
                    type: 'mrkdwn',
                    text: `*Not Voted:* ${offbox(unvoted.length)} *${unvoted.length}* (${names(unvoted)})`
                });
            if (counts.length > 0)
                blocks.push({
                    type: 'context',
                    elements: counts
                });
        }

        blocks.unshift({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: summary
            }
        });

        // TODO post as triggering user or with icon next to username
        let message, ts;
        try {
            message = {
                token: context.botToken,
                channel: poll.audience,
                username: `Poll: ${poll.prompt}`,
                icon_emoji: ':ballot_box_with_ballot:',
                text: summary,
                blocks: blocks
            };

            ts = (await client.chat.postMessage(message)).ts;
        }
        catch (error) {
            if (error.data.error == 'not_in_channel') {
                await client.conversations.join({
                    token: context.botToken,
                    channel: poll.audience
                });

                let modal = await informative_modal({ context, client,
                    title: 'Notice',
                    error: `<@${context.botUserId}> automatically joined the <#${poll.audience}> channel.`
                });

                await client.views.open({
                    token: context.botToken,
                    trigger_id: body.trigger_id,
                    view: modal
                });

                ts = (await client.chat.postMessage(message)).ts;
            }
            else throw error;
        }

        let permalink = ts ? (await client.chat.getPermalink({
            channel: poll.audience,
            message_ts: ts
        })).permalink : undefined;

        let coll = (await store).db().collection('polls');
        await coll.updateOne(
            { _id: new ObjectID(poll._id) },
            ts
                ? { $set: {
                    latest: {
                        summary: summary,
                        message_ts: ts,
                        permalink: permalink
                    }
                } }
                : { $unset: {
                    latest: undefined
                } }
        );
    };

    require('../events/create_poll_modal.js')({ app, store, announce });
    require('../events/create_poll_shortcut.js')({ app });
    require('../events/filter_polls_select.js')({ app, store });
    require('../events/go_to_polls_button.js')({ app });
    require('../events/poll_overflow_button.js')({ app, store, announce, timers });
    require('../events/vote_button.js')({ app, store, announce, timers });
};
