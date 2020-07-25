import { App, ButtonAction, InteractiveMessage } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import * as edit_macro_modal from './edit_macro_modal';

export const events = (app: App, store: Promise<MongoClient>): void => {
    app.action('edit_macro_button', async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id;

        let name = (action as ButtonAction).value;

        let replacement;
        if (name) {
            name = name.toLowerCase();

            const coll = (await store).db().collection('macros');
            const macros = (await coll.findOne(
                { _id: user },
                { projection: { _id: 0} }
            ));

            if (macros[name])
                replacement = macros[name];
        }

        await client.views.open({
            token: context.botToken,
            trigger_id: (body as InteractiveMessage).trigger_id,
            view: await edit_macro_modal.view(name, replacement)
        });
    });
};
