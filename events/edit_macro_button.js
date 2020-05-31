const edit_macro_modal = require('../views/edit_macro_modal.js');

module.exports = ({ app, store }) => {
    app.action('edit_macro_button', async ({ ack, body, action, context, client }) => {
        await ack();

        let user = body.user.id,
            name = action.value;

        let replacement;
        if (name) {
            name = name.toLowerCase();

            let coll = (await store).db().collection('macros');
            let macros = (await coll.findOne(
                { _id: user },
                { projection: { _id: 0} }
            ));

            if (macros[name])
                replacement = macros[name];
        }

        let modal = await edit_macro_modal({ name, replacement });

        await client.views.open({
            token: context.botToken,
            trigger_id: body.trigger_id,
            view: modal
        });
    });
};
