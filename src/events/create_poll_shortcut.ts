import { App, MessageShortcut } from '@slack/bolt';

import create_poll_modal from '../views/create_poll_modal';
import informative_modal from '../views/informative_modal';

export default (app: App): void => {
    app.shortcut('create_poll_shortcut', async ({ ack, shortcut, context, client }) => {
        await ack();

        const channel = (<MessageShortcut>shortcut)?.channel?.id;

        try {
            await client.views.open({
                token: context.botToken,
                trigger_id: shortcut.trigger_id,
                view: await create_poll_modal(channel, context, client)
            });
        }
        catch (err) {
            if (err.data.error == 'channel_not_found') {
                await client.views.open({
                    token: context.botToken,
                    trigger_id: shortcut.trigger_id,
                    view: await informative_modal({
                        title: 'Error',
                        error: "You can't create a poll in this conversation."
                    })
                });
            }
            else throw err;
        }
    });
};
