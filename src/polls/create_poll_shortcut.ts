import { App } from '@slack/bolt';
import * as information_modal from '../library/information_modal';
import * as create_poll_modal from './create_poll_modal';

export const register = ({ app }: { app: App }): void => {
    app.shortcut('create_poll_shortcut', async ({ ack, shortcut, context, client }) => {
        await ack();

        const channel = 'message' in shortcut
            ? shortcut.channel.id
            : undefined;

        try {
            await client.views.open({
                token: <string> context.botToken,
                trigger_id: shortcut.trigger_id,
                view: await create_poll_modal.view(channel, context, client)
            });
        }
        catch (error) {
            if ((<{ data: { error: string } }> error).data.error == 'channel_not_found') {
                await client.views.open({
                    token: <string> context.botToken,
                    trigger_id: shortcut.trigger_id,
                    view: information_modal.view({
                        title: 'Error',
                        error: "You can't create a poll in this conversation."
                    })
                });
            }
            else throw error;
        }
    });
};
