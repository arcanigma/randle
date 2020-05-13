const list_macros = async ({ user, store }) => {
    let blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '>>> *Roll Macros*'
            },
            accessory: {
                type: 'button',
                action_id: 'edit_macro_button',
                text: {
                    type: 'plain_text',
                    text: 'Create'
                }
            }
        },
        {
            type: 'divider'
        }
    ];

    let coll = (await store).db().collection('macros');
    let macros = (await coll.findOne(
        { _id: user },
        { projection: { _id: 0} }
    ));

    if (macros) {
        let names = Object.keys(macros).sort();

        for (let name of names) {
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*\`${name}\`* \u2022 ${macros[name]}`
                },
                accessory: {
                    type: 'button',
                    action_id: 'edit_macro_button',
                    text: {
                        type: 'plain_text',
                        text: `Edit`
                    },
                    value: name
                }
            });
        }
    }
    else {
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'plain_text',
                    text: 'You have no macros.'
                }
            ]
        });
    }

    return blocks;
};

const edit_macro_modal = async ({ name, replacement }) => {
    let blocks = [
        ...(!name ? [{
            type: 'input',
            block_id: 'name',
            label: {
                type: 'plain_text',
                text: 'Name'
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
                    text: 'name'
                }
            }
        }] : []),
        {
            type: 'input',
            block_id: 'replacement',
            label: {
                type: 'plain_text',
                text: 'Replacement'
            },
            element: {
                type: 'plain_text_input',
                action_id: 'input',
                min_length: 3,
                ...(replacement ? {initial_value: replacement} : {}),
                placeholder: {
                    type: 'plain_text',
                    text: 'replacement'
                }
            }
        },
        ...(name ? [{
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
                        value: 'delete',
                        text: {
                          type: 'plain_text',
                          text: 'Delete this macro.'
                        },
                        description: {
                            type: 'plain_text',
                            text: "This action can't be undone."
                        }
                    }
                ]
            }
        }] : [])
    ];

    // TODO private_metadata vs value
    let view = {
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
        blocks: blocks
    };

    return JSON.stringify(view);
};

module.exports = {
    list_macros,
    edit_macro_modal
};
