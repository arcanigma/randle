import { App, BlockAction, ButtonAction } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import * as edit_macro_modal from './edit_macro_modal';

export const register = ({ app, store }: { app: App; store: Promise<MongoClient> }): void => {
    app.action<BlockAction<ButtonAction>>('edit_macro_button', async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id;

        let name = action.value;

        let replacement;
        if (name) {
            name = name.toLowerCase();

            const coll = (await store).db().collection('macros');
            const macros = <{[key: string]: string}> await coll.findOne(
                { _id: user },
                { projection: { _id: 0 } }
            );

            if (macros[name])
                replacement = macros[name];
        }

        await client.views.open({
            token: <string> context.botToken,
            trigger_id: body.trigger_id,
            view: edit_macro_modal.view(name, replacement)
        });
    });
};
