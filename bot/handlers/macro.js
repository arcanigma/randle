const CONFIG = require('../config');

module.exports = function(controller, handler, users_cache) {

    // TODO: use the user_cache

    const set = /^[!\/]?(?:set|create|update|add|remember|make|save|new)\s*macro[s]?\s+([a-z][a-z0-9_]*)\s*=\s*"[\s.;,]*([^"]+?)[\s.;,]*"\s*$/i;
    controller.hears(set, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        let name = match[1].toLowerCase(),
            replace = match[2];

        controller.storage.users.get(message.user, function(err, user) {
            user = user || {'id': message.user};
            user.macros = user.macros || {};
            let updated = user.macros[name];
            user.macros[name] = replace;

            controller.storage.users.save(user, function(err) {
                let verb = updated ? 'updated' : 'created';
                bot.whisper(message, {
                    'text': `You ${verb} macro \`${name}\` with \`${replace}\` value.`
                });
            });

            users_cache.set(message.user, user);
        });
    });

    const del = /^[!\/]?(?:del|delete|rem|remove|drop|forget|unset|clear)\s*macro[s]?\s+([a-z][a-z0-9_]*)\s*$/i;
    controller.hears(del, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        let name = match[1].toLowerCase();

        controller.storage.users.get(message.user, function(err, user) {
            if (user && user.macros && user.macros[name]) {
                let replace = user.macros[name];
                delete user.macros[name];

                controller.storage.users.save(user, function(err) {
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

            users_cache.set(message.user, user);
        });
    });

    const get = /^[!\/]?(?:get|list|see|show|view|display|select|check|load)\s*macro[s]?(?:\s+([a-z][a-z0-9_]*))?\s*$/i;
    controller.hears(get, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        let name = match[1];

        controller.storage.users.get(message.user, function(err, user) {
            if (name) {
                name = name.toLowerCase();
                if (user && user.macros && user.macros[name]) {
                    bot.whisper(message, {
                        'text': `You have macro \`${name}\` with value \`${user.macros[name]}\`.`
                    });
                }
                else {
                    bot.whisper(message, {
                        'text': `You have no macro \`${name}\`.`
                    });
                }
            }
            else {
                if (user && user.macros && Object.keys(user.macros).length > 0) {
                    let names = Object.keys(user.macros).sort().join('`, `');
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

            users_cache.set(message.user, user);
        });
    });

};
