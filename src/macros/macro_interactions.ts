import { App, BlockAction, ButtonAction, CheckboxesAction } from '@slack/bolt';
import { InputBlock, View } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import { Cache } from '../app';
import * as home from '../home';
import { size } from '../library/factory';

export const view = ({ name, replacement }: { name: string; replacement: string | undefined }): View => ({
    type: 'modal',
    callback_id: 'edit_macro_modal',
    ...name ? { private_metadata: name } : {},
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
        ...!name ? [<InputBlock>{
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
        }] : [],
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
                ...replacement ? { initial_value: replacement } : {},
                placeholder: {
                    type: 'plain_text',
                    text: 'Text'
                }
            }
        },
        ...name ? [<InputBlock>{
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
        }] : []
    ]
});

type Input<T> = { input: T }
type Inputs<T> = { inputs: T }

export const register = ({ app, store, cache }: { app: App; store: Promise<MongoClient>; cache: Cache }): void => {
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
            view: view({ name, replacement })
        });
    });

    const re_macro = /^[\w_][\w\d_]{2,14}$/;
    app.view('edit_macro_modal', async ({ ack, body, view, context, client }) => {
        const user = body.user.id,
            data = view.state.values,
            name = (view.private_metadata || (<Input<ButtonAction>> data.name).input.value).toLowerCase(),
            replacement = (<Input<ButtonAction>> data.replacement).input.value,
            options = data.options ? ((<Inputs<CheckboxesAction>> data.options).inputs.selected_options ?? []).map(checkbox => <string> checkbox.value) : [];

        if (!re_macro.test(name)) {
            return await ack({
                response_action: 'errors',
                errors: {
                    name: 'You can only use letters, digits, and underscores starting with a letter or underscore.'
                }
            });
        }

        await ack();

        const coll = (await store).db().collection('macros');
        if (options.includes('delete')) {
            const macros = <{[key: string]: string}> (await coll.findOneAndUpdate(
                { _id: user },
                { $unset: { [name]: undefined } },
                { projection: { _id: 0 } }
            )).value;

            if (size(macros) == 1)
                await coll.deleteOne(
                    { _id: user }
                );
        }
        else {
            (await coll.findOneAndUpdate(
                { _id: user },
                { $set: { [name]: replacement } },
                { projection: { _id: 0 }, upsert: true }
            )).value;
        }

        await client.views.publish({
            token: <string> context.botToken,
            user_id: user,
            view: await home.view({ user, store, cache })
        });
    });
};
