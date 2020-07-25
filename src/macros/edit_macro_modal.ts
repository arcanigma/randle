import { App } from '@slack/bolt';
import { InputBlock, View } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import * as home from '../home';
import { size } from '../library/factory';

export const view = async (name: string, replacement: string): Promise<View> => ({
    type: 'modal',
    callback_id: 'edit_macro_modal',
    ...(name ? {private_metadata: name} : {}),
    title: {
        type: 'plain_text',
        text: name ? `Edit macro ${name}` : 'Create new macro'
    },
    submit: {
        type: 'plain_text',
        text: name ? 'Update' : 'Create'
    },
    close: {
        type: 'plain_text',
        text: 'Cancel'
    },
    blocks: [
        ...(!name ? [<InputBlock>{
            type: 'input',
            block_id: 'name',
            label: {
                type: 'plain_text',
                text: 'Macro Name'
            },
            hint: {
                type: 'plain_text',
                text: "Macro names are case insensitive. If the name is already in use, the existing macro's replacement will be updated instead."
            },
            element: {
                type: 'plain_text_input',
                action_id: 'input',
                min_length: 3,
                max_length: 15,
                placeholder: {
                    type: 'plain_text',
                    text: 'Name'
                }
            }
        }] : []),
        <InputBlock>{
            type: 'input',
            block_id: 'replacement',
            label: {
                type: 'plain_text',
                text: 'Replacement Text'
            },
            element: {
                type: 'plain_text_input',
                action_id: 'input',
                min_length: 3,
                ...(replacement ? {initial_value: replacement} : {}),
                placeholder: {
                    type: 'plain_text',
                    text: 'Text'
                }
            }
        },
        ...(name ? [<InputBlock>{
            type: 'input',
            optional: true,
            block_id: 'options',
            label: {
                type: 'plain_text',
                text: 'Settings'
            },
            element: {
                type: 'checkboxes',
                action_id: 'inputs',
                options: [
                    // TODO team-scoped macros if super user
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Delete this macro.'
                        },
                        description: {
                            type: 'plain_text',
                            text: "This action can't be undone."
                        },
                        value: 'delete'
                    }
                ]
            }
        }] : [])
    ]
});

export const events = (app: App, store: Promise<MongoClient>): void => {
    const re_macro = /^[\w_][\w\d_]{2,14}$/;
    app.view('edit_macro_modal', async ({ ack, body, view, context, client }) => {
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
            view: await home.view(user, store)
        });
    });
};
