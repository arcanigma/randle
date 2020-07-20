import { App } from '@slack/bolt';
import { MongoClient } from 'mongodb';

import { size } from '../library/factory';

import app_home from '../views/app_home';

export default (app: App, store: Promise<MongoClient>): void => {
    const re_macro = /^[\w_][\w\d_]{2,14}$/;
    app.view('edit_macro_modal', async ({ ack, body, context, view, client }) => {
        const user = body.user.id;

        let name = view.private_metadata || view.state.values.name.input.value;

        if (!re_macro.test(name)) {
            return await ack({
                response_action: 'errors',
                errors: {
                    name: 'You can only use letters, digits, and underscores starting with a letter or underscore.'
                }
            });
        }
        name = name.toLowerCase();

        const replacement = view.state.values.replacement.input.value;

        let options_selected = [];
        if (view.state.values.options && view.state.values.options.inputs.selected_options)
            options_selected = view.state.values.options.inputs.selected_options.map((checkbox: { value: string}) => checkbox.value);

        await ack();

        const coll = (await store).db().collection('macros');
        if (options_selected.includes('delete')) {
            const macros = (await coll.findOneAndUpdate(
                { _id: user },
                { $unset: { [name]: undefined } },
                { projection: { _id: 0} }
            )).value;

            if (size(macros)  == 1)
                coll.deleteOne(
                    { _id: user }
                );
        }
        else {
            (await coll.findOneAndUpdate(
                { _id: user },
                { $set: { [name]: replacement } },
                { projection: { _id: 0}, upsert: true }
            )).value;
        }

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: await app_home(user, store)
        });
    });
};
