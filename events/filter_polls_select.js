const app_home = require('../views/app_home.js');

module.exports = ({ app, store }) => {
    app.action('filter_polls_select', async ({ ack, body, action, context, client }) => {
        await ack();

        let user = body.user.id,
            filter = action.selected_option.value;

        let home = await app_home({ user, store, options: {
            polls: { filter }
        }});

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: home
        });
    });
};
