const { size } = require('../library/factory.js'),
      app_home = require('../views/app_home.js');

module.exports = ({ app, store }) => {
    const re_macro = /^[\w_][\w\d_]{2,14}$/;
    app.view('edit_macro_modal', async ({ ack, body, context, view, client }) => {
        let user = body.user.id,
            name = view.private_metadata || view.state.values.name.input.value;

        if (!re_macro.test(name)) {
            return await ack({
                response_action: 'errors',
                errors: {
                    name: 'You can only use letters, digits, and underscores starting with a letter or underscore.'
                }
            });
        }
        name = name.toLowerCase();

        let replacement = view.state.values.replacement.input.value;

        let options_selected = [];
        if (view.state.values.options && view.state.values.options.inputs.selected_options)
            options_selected = view.state.values.options.inputs.selected_options.map(obj => obj.value);

        await ack();

        let coll = (await store).db().collection('macros');
        if (options_selected.includes('delete')) {
            let macros = (await coll.findOneAndUpdate(
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

        let home = await app_home({ user, store });

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: home
        });
    });
};
