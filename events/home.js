const { home_view } = require('../views/home.js');

module.exports = (app, store) => {

    app.event('app_home_opened', async ({ event, context, client }) => {
        let user = event.user,
            home = await home_view({ user, store });

        await client.views.publish({
            token: context.botToken,
            user_id: event.user,
            view: home
        });
    });

};
