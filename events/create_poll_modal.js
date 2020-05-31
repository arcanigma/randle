const { size } = require('../library/factory.js');

module.exports = ({ app, store, announce }) => {
    const re_lines = /\r\n|\r|\n/,
          re_mrkdwn = /([*_~`])/g,
          re_mrkdwn_emoji = /([*_~`:])/g;
    app.view('create_poll_modal', async ({ ack, body, context, view, client }) => {
        let errors = {},
            host = body.user.id,
            data = view.state.values,
            audience = data.audience.input.selected_channel,
            members = data.members.input.selected_users,
            prompt = data.prompt.input.value.replace(re_lines, ' ').replace(re_mrkdwn_emoji, ''),
            choices = data.choices.input.value.trim().split(re_lines).map(choice => choice.trim().replace(re_mrkdwn, '')).filter(Boolean),
            setup = (data.setup.inputs.selected_options || []).map(checkbox => checkbox.value);

        if (members.includes(context.botUserId))
            errors.members = `You can't choose this bot as a member.`;
        else if (members.length < 2)
            errors.members = 'You must choose at least 2 members.';

        if ([...new Set(choices)].length < choices.length)
            errors.choices = "You can't repeat any choices.";
        else if (choices.length < 2 || choices.length > 10)
            errors.choices = 'You must list from 2 to 10 choices.';

        if (size(errors) > 0)
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

        await announce({ context, body, poll, client, mode: 'open' });
    });
};
