const { home_view } = require('../views/home.js');

module.exports = (app, store) => {

    app.event('app_home_opened', async ({ event, context, payload }) => {
        let home = await home_view(store, event.user);

        let result = await app.client.views.publish({
            token: context.botToken,
            user_id: event.user,
            view: home
        });
    });

}
