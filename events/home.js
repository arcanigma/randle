const { home_view } = require('../views/home.js');

module.exports = (app, store) => {

    app.event('app_home_opened', async ({ event, context }) => {
        let home = await home_view(store, event.user);

        await app.client.views.publish({
            token: context.botToken,
            user_id: event.user,
            view: home
        });
    });

}
