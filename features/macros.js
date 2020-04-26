const { who, blame} = require('../plugins/factory.js'),
      { nonthread, direct } = require('../plugins/listen.js'),
      { collection } = require('../plugins/storage.js');

module.exports = (app) => {

    const DICTIONARY = { // TODO super use creates, bot owns
        'adv': '2d20H',
        'dis': '2d20L'
    }

    const re_create_update = /^!?(?:create|update)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*=\s*"[\s.;,]*([^"]+?)[\s.;,]*"\s*$/i;
    app.message(nonthread, direct, re_create_update, async ({ message, context, say }) => {
        try {
            let name = context.matches[1].toLowerCase(),
                replace = context.matches[2];

            if (name in DICTIONARY) {
                await say({
                    text: `You can't do that. Everyone has the macro \`${name}\` with the value \`${DICTIONARY[name]}\`.`
                });
            }
            else {
                let coll = await collection('macros');
                let macros = (await coll.findOneAndUpdate(
                    { _id: message.user },
                    { $set: { [name]: replace } },
                    { projection: { _id: 0}, upsert: true }
                )).value || {};

                if (macros[name])
                    await say({
                        text: `You updated the macro \`${name}\` from the value \`${macros[name]}\` to the value \`${replace}\`.`
                    });
                else
                    await say({
                        text: `You created the macro \`${name}\` with the value \`${replace}\`.`
                    });
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_delete = /^!?delete\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*$/i;
    app.message(nonthread, direct, re_delete, async ({ message, context, say }) => {
        try {
            let name = context.matches[1].toLowerCase();

            if (name in DICTIONARY) {
                await say({
                    text: `You can't do that. Everyone has the macro \`${name}\` with the value \`${DICTIONARY[name]}\`.`
                });
            }
            else {
                let coll = await collection('macros');
                let macros = (await coll.findOneAndUpdate(
                    { _id: message.user },
                    { $unset: { [name]: undefined } },
                    { projection: { _id: 0} }
                )).value || {};

                if (Object.keys(macros).length == 1) {
                    coll.deleteOne(
                        { _id: message.user }
                    )
                }

                if (macros[name])
                    await say({
                        text: `You removed the macro \`${name}\` with the value \`${macros[name]}\`.`
                    });
                else
                    await say({
                        text: `You have no macro \`${name}\`.`
                    });
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_read = /^!?read\s+macro[s]?(?:\s+([a-z][a-z0-9_]*))?\s*$/i;
    app.message(nonthread, direct, re_read, async ({ message, context, say }) => {
        try {
            let name = context.matches[1];

            if (name && name in DICTIONARY) {
                await say({
                    text: `Everyone has the macro \`${name}\` with the value \`${DICTIONARY[name]}\`.`
                });
            }
            else {
                let coll = await collection('macros');
                let macros = (await coll.findOne(
                    { _id: message.user },
                    { projection: { _id: 0} }
                )) || {} ;

                if (name) {
                    name = name.toLowerCase();

                    if (macros[name])
                        await say({
                            text: `You have the macro \`${name}\` with the value \`${macros[name]}\`.`
                        });
                    else
                        await say({
                            text: `You have no macro \`${name}\`.`
                        });
                }
                else {
                    let names = macros ? Object.keys(macros) : {};
                    if (names.length > 0)
                        await say({
                            text: `You have the macro${names.length > 1 ? 's' : ''} \`${names.sort().join('`, `')}\`.`
                        });
                    else
                        await say({
                            text: `You have no macros.`
                        });
                }
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

};
