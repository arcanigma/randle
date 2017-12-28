const CONFIG = require('../config');

module.exports = function(controller, handler, user_db) {

    const set = /^[!\/]?(?:set|create|update|add|remember|make|save|new)\s*macro[s]?\s+([a-z][a-z0-9_]*)\s*=\s*"[\s.;,]*([^"]+?)[\s.;,]*"\s*$/i;
    controller.hears(set, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        let name = match[1].toLowerCase(),
            replace = match[2];

        user_db.get(message.user, function(err, data) {
            data = data || {};
            data.id = data.id || message.user;
            data.macros = data.macros || {};
            let updated = data.macros[name];
            data.macros[name] = replace;

            user_db.set(data, function(err) {
                let verb = updated ? 'updated' : 'created';
                bot.whisper(message, {
                    'text': `You ${verb} macro \`${name}\` with \`${replace}\` value.`
                });
            });
        });
    });

    const del = /^[!\/]?(?:del|delete|rem|remove|drop|forget|unset|clear)\s*macro[s]?\s+([a-z][a-z0-9_]*)\s*$/i;
    controller.hears(del, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        let name = match[1].toLowerCase();

        user_db.get(message.user, function(err, data) {
            if (data && data.macros && data.macros[name]) {
                let replace = data.macros[name];
                delete data.macros[name];

                user_db.set(data, function(err) {
                    bot.whisper(message, {
                        'text': `You removed macro \`${name}\` with value \`${replace}\`.`
                    });
                });
            }
            else {
                bot.whisper(message, {
                    'text': `You have no macro \`${name}\`.`
                });
            }
        });
    });

    const get = /^[!\/]?(?:get|list|see|show|view|display|select|check|load)\s*macro[s]?(?:\s+([a-z][a-z0-9_]*))?\s*$/i;
    controller.hears(get, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        let name = match[1];

        user_db.get(message.user, function(err, data) {
            if (name) {
                name = name.toLowerCase();
                if (data && data.macros && data.macros[name]) {
                    bot.whisper(message, {
                        'text': `You have macro \`${name}\` with value \`${data.macros[name]}\`.`
                    });
                }
                else {
                    bot.whisper(message, {
                        'text': `You have no macro \`${name}\`.`
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
    });

};
