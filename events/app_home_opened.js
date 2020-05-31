const app_home = require('../views/app_home.js');

module.exports = ({ app, store }) => {
    app.event('app_home_opened', async ({ event, context, client }) => {
        let user = event.user,
            home = await app_home({ user, store });

        await client.views.publish({
            token: context.botToken,
            user_id: event.user,
            view: home
        });
    });
};
