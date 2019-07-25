const CONFIG = require('../config');

module.exports = function(controller) {

    controller.middleware.ingest.use(async(bot, message, next) => {
        let store = await getPreparedStore(message.user);
        message.injection = message.injection || {};
        message.injection.macros = store[message.user].macros;

        next();
    });

    const add = /^!?(?:add|create|edit|insert|make|new|put|remember|save|set|update)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*=\s*"[\s.;,]*([^"]+?)[\s.;,]*"\s*$/i;
    controller.hears(add, CONFIG.HEAR_DIRECTLY, async(bot, message) => {
        try {
            let name = message.matches[1].toLowerCase(),
                replace = message.matches[2];

            let store = await getPreparedStore(message.user);

            let verb = store[message.user].macros[name] ? 'updated' : 'created';
            store[message.user].macros[name] = replace;

            await controller.plugins.states.user.write({ [message.user]: store[message.user] });

            await bot.replyEphemeral(message, {
                'text': `You ${verb} the macro \`${name}\` with the value \`${replace}\`.`
            });
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    const drop = /^!?(?:cancel|clear|delete|drop|erase|forget|remove|unset)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*$/i;
    controller.hears(drop, CONFIG.HEAR_DIRECTLY, async(bot, message) => {
        try {
            let name = message.matches[1].toLowerCase();

            let store = await getPreparedStore(message.user);

            if (store[message.user].macros[name]) {
                let replace = store[message.user].macros[name];
                delete store[message.user].macros[name];

                await controller.plugins.states.user.write({ [message.user]: store[message.user] });

                await bot.replyEphemeral(message, {
                    'text': `You removed the macro \`${name}\` with the value \`${replace}\`.`
                });
            }
            else {
                await bot.replyEphemeral(message, {
                    'text': `You have no macro \`${name}\`.`
                });
            }
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    const select = /^!?(?:check|display|find|get|list|load|see|select|show|view)\s+macro[s]?(?:\s+([a-z][a-z0-9_]*))?\s*$/i;
    controller.hears(select, CONFIG.HEAR_DIRECTLY, async(bot, message) => {
        try {
            let name = message.matches[1];

            let store = await getPreparedStore(message.user);

            if (name) {
                name = name.toLowerCase();
                let value = store[message.user].macros[name];
                if (value) {
                    await bot.replyEphemeral(message, {
                        'text': `You have the macro \`${name}\` with the value \`${value}\`.`
                    });
                }
                else {
                    await bot.replyEphemeral(message, {
                        'text': `You have no macro \`${name}\`.`
                    });
                }
            }
            else {
                let names = Object.keys(store[message.user].macros);
                if (names.length > 0) {
                    let list = names.sort().join('`, `');
                    await bot.replyEphemeral(message, {
                        'text': `You have the macros \`${list}\`.`
                    });
                }
                else {
                    await bot.replyEphemeral(message, {
                        'text': `You have no macros.`
                    });
                }
            }
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    async function getPreparedStore(uid) {
        let store = await controller.plugins.states.user.read([uid]);
        store = store || {};
        store[uid] = store[uid] || {};
        store[uid].macros = store[uid].macros || {};

        return store;
    }

};
