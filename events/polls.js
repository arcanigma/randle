const { ObjectID } = require('mongodb');

const { commas, names } = require('../plugins/factory.js'),
      { create_poll_modal } = require('../views/polls.js'),
      { informative_modal } = require('../views/utility.js'),
      { home_view } = require('../views/home.js');

module.exports = (app, store) => {

    const AUTOCLOSE_GRACE = 30;

    var timers = {};

    app.shortcut('create_poll_shortcut', async ({ ack, shortcut, context, client }) => {
        await ack();

        let channel = shortcut.channel ? shortcut.channel.id : undefined,
            message = shortcut.message;

        try {
            let modal = await create_poll_modal({ channel, message, context, client });

            await client.views.open({
                token: context.botToken,
                trigger_id: shortcut.trigger_id,
                view: modal
            });
        }
        catch (error) {
            if (error.data.error == 'channel_not_found') {
                let modal = await informative_modal({ context, client,
                    title: 'Error',
                    error: "You can't create a poll in this conversation."
                });

                await client.views.open({
                    token: context.botToken,
                    trigger_id: shortcut.trigger_id,
                    view: modal
                });
            }
            else throw error;
        }
    });

    const re_lines = /\r\n|\r|\n/;
    app.view('create_poll_modal', async ({ ack, body, context, view, client }) => {
        let errors = {},
            host = body.user.id,
            data = view.state.values,
            audience = data.audience.input.selected_channel,
            members = data.members.input.selected_users,
            prompt = data.prompt.input.value.replace(re_lines, ' '),
            choices = data.choices.input.value.trim().split(re_lines).map(choice => choice.trim()).filter(Boolean),
            setup = (data.setup.inputs.selected_options || []).map(checkbox => checkbox.value);

        if (members.includes(context.botUserId)) // TODO filter all bots
            errors.members = "You can't choose a bot as a member.";
        else if (members.length < 2)
            errors.members = 'You must choose at least 2 members.';

        if ([...new Set(choices)].length < choices.length)
            errors.choices = "You can't repeat any choices.";
        else if (choices.length < 2 || choices.length > 10)
            errors.choices = 'You must list from 2 to 10 choices.';

        if (Object.keys(errors).length > 0)
            return await ack({
                response_action: 'errors',
                errors
            });

        await ack();

        let poll = {
            opened: new Date(),
            host,
            audience,
            members,
            prompt,
            choices,
            setup,
            votes: {}
        };

        let coll = (await store).db().collection('polls');
        poll._id = (await coll.insertOne(poll)).insertedId;

        await postPollAnnouncement({ context, body, poll, client, mode: 'open' });
    });

    app.action('filter_polls_select', async ({ ack, body, action, context, client }) => {
        await ack();

        let user = body.user.id,
            filter = action.selected_option.value;

        let home = await home_view({ user, store, options: {
            polls: { filter }
        }});

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: home
        });
    });

    app.action(/^vote_button_\d+_open$/, async ({ ack, body, action, context, client }) => {
        await ack();

        let user = body.user.id,
            data = JSON.parse(action.value);

        let coll = (await store).db().collection('polls');
        let poll = (await coll.findOneAndUpdate(
            {
                _id: new ObjectID(data.poll),
                members: { $in: [user] },
                closed: { $exists: false }
            },
            data.choice !== null
                ? { $set: { [`votes.${user}`]: data.choice } }
                : { $unset: { [`votes.${user}`]: undefined } },
            { returnOriginal: false }
        )).value;

        if (poll.setup.includes('participation'))
            await postPollAnnouncement({ context, body, poll, client, mode: 'participate' });

        if (poll.setup.includes('autoclose')) {
            if (timers[data.poll]) {
                clearTimeout(timers[data.poll]);
                delete timers[data.poll];
            }

            if (tallyOf(poll) == poll.members.length) {
                timers[data.poll] = setTimeout(async () => {
                    delete timers[data.poll];

                    poll = (await coll.findOne({
                        _id: new ObjectID(data.poll)
                    }));

                    if (tallyOf(poll) == poll.members.length) {
                        await coll.updateOne(
                            { _id: new ObjectID(data.poll) },
                            { $set: { closed: new Date() } }
                        );

                        await postPollAnnouncement({ context, body, poll, client, mode: 'close' });
                    }
                }, AUTOCLOSE_GRACE * 1000);

                let modal = await informative_modal({ context, client,
                    title: 'Warning',
                    error: `You cast the last vote. The poll automatically closes within *${AUTOCLOSE_GRACE}* seconds if no votes are recast or uncast.`
                });

                await client.views.open({
                    token: context.botToken,
                    trigger_id: body.trigger_id,
                    view: modal
                });
            }
        }

        let home = await home_view({ user, store });

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: home
        });
    });

    app.action(/^vote_button_\d+_(?:closed|nonmember)$/, async ({ ack, body, action, context, client }) => {
        await ack();

        let modal = await informative_modal({ context, client,
            title: 'Error',
            error: action.action_id.endsWith('closed')
                ? "You can't vote in a closed poll."
                : "You can't vote if you're not a member of the poll, even if you're the host."
        });

        await client.views.open({
            token: context.botToken,
            trigger_id: body.trigger_id,
            view: modal
        });
    });

    app.action('poll_overflow_button', async ({ ack, body, action, context, client }) => {
        await ack();

        let user = body.user.id,
            data = JSON.parse(action.selected_option.value);

        if (timers[data.poll]) {
            clearTimeout(timers[data.poll]);
            delete timers[data.poll];
        }

        let options;
        if (data.admin == 'close') {
            let coll = (await store).db().collection('polls');
            let poll = (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                { $set: { closed: new Date() } }
            )).value;

            await postPollAnnouncement({ context, body, poll, client, mode: 'close' });

            options = { polls: { filter: 'closed' } };
        }
        else if (data.admin == 'reannounce') {
            let coll = (await store).db().collection('polls');
            let poll = (await coll.findOne({
                _id: new ObjectID(data.poll),
                host: user
            }));

            await postPollAnnouncement({ context, body, poll, client, mode: 'reannounce' });

            options = { polls: { filter: 'open' } };
        }
        else if (data.admin == 'reopen') {
            let coll = (await store).db().collection('polls');
            let poll = (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                {
                    $set: { opened: new Date() },
                    $unset: { closed: undefined }
                }
            )).value;

            await postPollAnnouncement({ context, body, poll, client, mode: 'reopen' });

            options = { polls: { filter: 'open' } };
        }
        else if (data.admin == 'delete') {
            let coll = (await store).db().collection('polls');
            await coll.deleteOne({
                _id: new ObjectID(data.poll),
                host: user,
                closed: { $exists: true }
            });

            options = { polls: { filter: 'closed' } };
        }

        let home = await home_view({ user, store, options });

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: home
        });
    });

    const tallyOf = (poll) => {
        return Object.keys(poll.votes).length;
    };

    const progressBar = (count, total, max) => {
        let width = Math.min(total, max),
            squares = Math.round(count / total * width);
        return '\uD83D\uDD33'.repeat(squares) + '\u2B1C'.repeat(width - squares);
    };

    const postPollAnnouncement = async ({ context, body, poll, client, mode }) => {
        let user = body.user.id,
            tally = tallyOf(poll);

        let header,
            sections = [];

        // TODO cleanse formatting and emoji from prompt
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

            // TODO cleanse formatting from choices
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
                `*Voted:* ${progressBar(tally, poll.members.length, 12)} *${tally}* / ${poll.members.length}`
            );
        }
        else if (mode == 'close') {
            sections.push(
                `<@${poll.host}> closed a poll`
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
                    // TODO cleanse formatting from choice
                    `${progressBar(cohort.length, poll.members.length, 12)} *${cohort.length}* \u2022 *${choice}*${!poll.setup.includes('anonymous') ? ` \u2022 ${names(cohort)}` : ''}`
                );
            });
        }

        let succinct = (await client.conversations.history({
            token: context.botToken,
            channel: poll.audience,
            limit: 1
        })).messages[0].user == context.botUserId;

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

        try {
            await client.chat.postMessage(post);
        }
        catch (error) {
            if (error.data.error == 'not_in_channel') {
                await client.conversations.join({
                    token: context.botToken,
                    channel: poll.audience
                });

                let modal = await informative_modal({ context, client,
                    title: 'Notice',
                    error: `Automatically added <@${context.botUserId}> to the <#${poll.audience}> channel.`
                });

                await client.views.open({
                    token: context.botToken,
                    trigger_id: body.trigger_id,
                    view: modal
                });

                await client.chat.postMessage(post);
            }
            else throw error;
        }
    };

};
