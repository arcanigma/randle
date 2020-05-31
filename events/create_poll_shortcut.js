const create_poll_modal = require('../views/create_poll_modal.js'),
      informative_modal = require('../views/informative_modal.js');

module.exports = ({ app }) => {
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
};
