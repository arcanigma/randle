const CONFIG = require('../config');

module.exports = function(controller, handler, user_table) {

    // TODO: enable macros

    controller.middleware.heard.use(function(bot, message, next) {
        user_table.get(message.user, function(err, data) {
            if (!err) message.user_data = data;
            next();
        });
    });

    const add = /^!?(?:add|create|edit|insert|make|new|put|remember|save|set|update)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*=\s*"[\s.;,]*([^"]+?)[\s.;,]*"\s*$/i;
    controller.hears(add, CONFIG.HEAR_DIRECTLY, function(bot, message) {
        try {
            let name = message.matches[1].toLowerCase(),
                replace = message.matches[2];

            user_table.get(message.user, function(err, data) {
                data = data || {};
                data.id = data.id || message.user;
                data.macros = data.macros || {};
                let updated = data.macros[name];
                data.macros[name] = replace;

                user_table.set(data, function(err) {
                    let verb = updated ? 'updated' : 'created';
                    bot.replyEphemeral(message, {
                        'text': `You ${verb} the macro \`${name}\` with the value \`${replace}\`.`
                    });
                });
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    const drop = /^!?(?:cancel|clear|delete|drop|erase|forget|remove|unset)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*$/i;
    controller.hears(drop, CONFIG.HEAR_DIRECTLY, function(bot, message) {
        try {
            let name = message.matches[1].toLowerCase();

            user_table.get(message.user, function(err, data) {
                if (data && data.macros && data.macros[name]) {
                    let replace = data.macros[name];
                    delete data.macros[name];

                    user_table.set(data, function(err) {
                        bot.replyEphemeral(message, {
                            'text': `You removed the macro \`${name}\` with the value \`${replace}\`.`
                        });
                    });
                }
                else {
                    bot.replyEphemeral(message, {
                        'text': `You have no macro named \`${name}\`.`
                    });
                }
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    const select = /^!?(?:check|display|find|get|list|load|see|select|show|view)\s+macro[s]?(?:\s+([a-z][a-z0-9_]*))?\s*$/i;
    controller.hears(select, CONFIG.HEAR_DIRECTLY, function(bot, message) {
        try {
            let name = message.matches[1];

            user_table.get(message.user, function(err, data) {
                if (name) {
                    name = name.toLowerCase();
                    if (data && data.macros && data.macros[name]) {
                        bot.replyEphemeral(message, {
                            'text': `You have the macro \`${name}\` with the value \`${data.macros[name]}\`.`
                        });
                    }
                    else {
                        bot.replyEphemeral(message, {
                            'text': `You have no macro named \`${name}\`.`
                        });
                    }
                }
                else {
                    if (data && data.macros && Object.keys(data.macros).length > 0) {
                        let names = Object.keys(data.macros).sort().join('`, `');
                        bot.replyEphemeral(message, {
                            'text': `You have the macros \`${names}\`.`
                        });
                    }
                    else {
                        bot.replyEphemeral(message, {
                            'text': `You have no macros.`
                        });
                    }
                }
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

};
