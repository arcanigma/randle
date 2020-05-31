module.exports = async ({ user, store }) => {
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
