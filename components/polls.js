const { commas, names, size, progress } = require('../library/factory.js'),
      informative_modal = require('../views/informative_modal.js');

module.exports = ({ app, store }) => {
    const timers = {};

    const announce = async ({ context, body, poll, client, mode }) => {
        let user = body.user.id,
            tally = size(poll.votes);

        let header,
            sections = [];

        header = `:ballot_box_with_ballot: *${poll.prompt}* \u2022 <slack://app?team=${body.team.id}&id=${body.api_app_id}|go to polls>`;

        if (mode == 'open' || mode == 'reopen' || mode == 'reannounce') {
            sections.push(
                `<@${poll.host}> ${{
                    open: 'opened',
                    reopen: 'reopened',
                    reannounce: 'reannounced'
                }[mode]} a poll`
            );

            sections.push(
                `*Members:* ${names(poll.members)}`
            );

            sections.push(
                `*Choices:* ${poll.choices.join(' \u2022 ')}`
            );

            sections.push(
                `*Setup:* ${commas(poll.setup.map(option => ({
                    participation: 'participation notices',
                    anonymous: 'anonymous voting',
                    autoclose: 'automatic closing'
                })[option]))}`
            );
        }
        else if (mode == 'participate') {
            sections.push(
                `<@${user}> ${poll.votes[user] !== undefined ? 'voted' : 'unvoted'}`
            );

            sections.push(
                `*Voted:* ${progress(tally, poll.members.length, 12)} *${tally}* / ${poll.members.length}`
            );
        }
        else if (mode == 'close' || mode == 'autoclose') {
            sections.push(
                mode == 'close'
                ? `<@${poll.host}> closed a poll`
                : `<@${context.botUserId}> automatically closed a poll`
            );

            if (poll.setup.includes('anonymous')) {
                let voted = poll.members.filter(member => poll.votes[member] !== undefined);

                sections.push(
                    `*Voted:* ${names(voted)}`
                );
            }

            poll.choices.forEach((choice, index) => {
                let cohort = poll.members.filter(member => poll.votes[member] === index);
                sections.push(
                    `${progress(cohort.length, poll.members.length, 12)} *${cohort.length}* \u2022 *${choice}*${!poll.setup.includes('anonymous') ? ` \u2022 ${names(cohort)}` : ''}`
                );
            });
        }

        let succinct;
        try {
            succinct = (await client.conversations.history({
                token: context.botToken,
                channel: poll.audience,
                limit: 1
            })).messages[0].user == context.botUserId;
        }
        catch (error) {
            if (error.data.error == 'not_in_channel') {
                succinct = false;

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
            }
            else throw error;
        }

        let post = {
            token: context.botToken,
            channel: poll.audience,
            text: sections[0],
            blocks: [ {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: !succinct
                        ? `${header}\n\n>>>${sections.join('\n\n')}`
                        : `>>>${sections.join('\n\n')}`
                }
            }]
        };

        await client.chat.postMessage(post);
    };

    require('../events/create_poll_modal.js')({ app, store, announce });
    require('../events/create_poll_shortcut.js')({ app });
    require('../events/filter_polls_select.js')({ app, store });
    require('../events/poll_overflow_button.js')({ app, store, announce, timers });
    require('../events/vote_button.js')({ app, store, announce, timers });
};
