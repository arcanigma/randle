const CONFIG = require('../config'),
      { MongoDbStorage } = require('botbuilder-storage-mongodb');

module.exports = function(botkit) {

    return {
        name: 'Macros',

        init: function(controller) {
            let storage = new MongoDbStorage({
                url: process.env.MONGODB_URI,
                database: CONFIG.DATABASE,
                collection: CONFIG.COLLECTIONS.MACRO
            });

            const dictionary = {
                'adv': '2d20H',
                'dis': '2d20L'
            };

            controller.middleware.receive.use(async(bot, message, next) => {
                if (CONFIG.HEAR_ANYWHERE.includes(message.type) && !message.macro_text) {
                    let macros = (await storage.read([message.user]))[message.user];
                    delete macros.eTag;
                    Object.assign(macros, controller.plugins.macros.dictionary);

                    let regex = new RegExp('\\b(' + Object.keys(macros).join('|') + ')\\b', 'gi');
                    let replaced;
                    if (message.text) replaced = message.text.replace(regex, function(match) {
                        return macros[match];
                    });
                    if (message.text !== replaced)
                        message.macro_text = replaced
                }

                next();
            });

            const add = /^!?(?:add|change|create|edit|insert|make|new|put|remember|save|set|update)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*=\s*"[\s.;,]*([^"]+?)[\s.;,]*"\s*$/i;
            controller.interrupts(add, CONFIG.HEAR_DIRECTLY, async(bot, message) => {
                try {
                    let name = message.matches[1].toLowerCase(),
                        replace = message.matches[2];

                    if (name in dictionary) {
                        await bot.replyEphemeral(message, {
                            'text': `You can't do that: everyone has the macro \`${name}\` with the value \`${dictionary[name]}\`.`
                        });
                    }
                    else {
                        let macros = (await storage.read([message.user]))[message.user];
                        delete macros.eTag;

                        let verb = macros[name] ? 'updated' : 'created';
                        macros[name] = replace;

                        await storage.write({[message.user]: macros});

                        await bot.replyEphemeral(message, {
                            'text': `You ${verb} the macro \`${name}\` with the value \`${replace}\`.`
                        });
                    }
                }
                catch(err) {
                    await controller.plugins.handler.explain(err, bot, message);
                }
            });

            const drop = /^!?(?:cancel|clear|delete|drop|erase|forget|remove|unset)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*$/i;
            controller.interrupts(drop, CONFIG.HEAR_DIRECTLY, async(bot, message) => {
                try {
                    let name = message.matches[1].toLowerCase();

                    let macros = (await storage.read([message.user]))[message.user];
                    delete macros.eTag;

                    if (name in dictionary) {
                        await bot.replyEphemeral(message, {
                            'text': `You can't do that: everyone has the macro \`${name}\` with the value \`${dictionary[name]}\`.`
                        });
                    }
                    else if (macros[name]) {
                        let replace = macros[name];
                        delete macros[name];

                        await storage.write({[message.user]: macros});

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
            controller.interrupts(select, CONFIG.HEAR_DIRECTLY, async(bot, message) => {
                try {
                    let name = message.matches[1];

                    let macros = (await storage.read([message.user]))[message.user];
                    delete macros.eTag;

                    if (name) {
                        name = name.toLowerCase();
                        if (name in dictionary) {
                            await bot.replyEphemeral(message, {
                                'text': `Everyone has the macro \`${name}\` with the value \`${dictionary[name]}\`.`
                            });
                        }
                        else if (macros[name]) {
                            await bot.replyEphemeral(message, {
                                'text': `You have the macro \`${name}\` with the value \`${macros[name]}\`.`
                            });
                        }
                        else {
                            await bot.replyEphemeral(message, {
                                'text': `You have no macro \`${name}\`.`
                            });
                        }
                    }
                    else {
                        let names = Object.keys(macros);
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

            controller.addPluginExtension('macros', this);
        },

        matches: function(regex) {
            return async function(message) {
                if (message.macro_text)
                    message.text = message.macro_text;

                if (message.text) {
                    let matches = message.text.match(regex);
                    if (matches) {
                        message.matches = matches;
                        return true;
                    }
                }

                return false;
            }
        }
    };

};
