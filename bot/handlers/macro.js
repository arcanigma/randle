const CONFIG = require('../config');

module.exports = function(controller, handler, user_table) {

    controller.middleware.heard.use(function(bot, message, next) {
        user_table.get(message.user, function(err, data) {
            if (!err) message.user_data = data;
            next();
        });
    });

    const set = /^!?(?:add|create|edit|insert|make|new|put|remember|save|set|update)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*=\s*"[\s.;,]*([^"]+?)[\s.;,]*"\s*$/i;
    controller.hears(set, CONFIG.HEAR_DIRECTLY, function(bot, message) {
        try {
            let name = message.match[1].toLowerCase(),
                replace = message.match[2];

            user_table.get(message.user, function(err, data) {
                data = data || {};
                data.id = data.id || message.user;
                data.macros = data.macros || {};
                let updated = data.macros[name];
                data.macros[name] = replace;

                user_table.set(data, function(err) {
                    let verb = updated ? 'updated' : 'created';
                    bot.whisper(message, {
                        'text': `You ${verb} the macro \`${name}\` with the value \`${replace}\`.`
                    });
                });
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    const del = /^!?(?:cancel|clear|delete|drop|erase|forget|remove|unset)\s+macro[s]?\s+([a-z][a-z0-9_]*)\s*$/i;
    controller.hears(del, CONFIG.HEAR_DIRECTLY, function(bot, message) {
        try {
            let name = message.match[1].toLowerCase();

            user_table.get(message.user, function(err, data) {
                if (data && data.macros && data.macros[name]) {
                    let replace = data.macros[name];
                    delete data.macros[name];

                    user_table.set(data, function(err) {
                        bot.whisper(message, {
                            'text': `You removed the macro \`${name}\` with the value \`${replace}\`.`
                        });
                    });
                }
                else {
                    bot.whisper(message, {
                        'text': `You have no macro named \`${name}\`.`
                    });
                }
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    const get = /^!?(?:check|display|find|get|list|load|see|select|show|view)\s+macro[s]?(?:\s+([a-z][a-z0-9_]*))?\s*$/i;
    controller.hears(get, CONFIG.HEAR_DIRECTLY, function(bot, message) {
        try {
            let name = message.match[1];

            user_table.get(message.user, function(err, data) {
                if (name) {
                    name = name.toLowerCase();
                    if (data && data.macros && data.macros[name]) {
                        bot.whisper(message, {
                            'text': `You have the macro \`${name}\` with the value \`${data.macros[name]}\`.`
                        });
                    }
                    else {
                        bot.whisper(message, {
                            'text': `You have no macro named \`${name}\`.`
                        });
                    }
                }
                else {
                    if (data && data.macros && Object.keys(data.macros).length > 0) {
                        let names = Object.keys(data.macros).sort().join('`, `');
                        bot.whisper(message, {
                            'text': `You have the macros \`${names}\`.`
                        });
                    }
                    else {
                        bot.whisper(message, {
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
