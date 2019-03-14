const CONFIG = require('../config');

module.exports = function(controller, handler) {

    controller.hears(/^!?echo\b(.*)/i, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        try {
            bot.replyWithTyping(message, message.match[1].trim());
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    controller.hears(/^!?throw\s+(system|user)\s+error\b(.*)/i, CONFIG.HEAR_EXPLICIT, function(bot, message) {
        try {
            if (message.match[1] == 'system')
                throw new Error(message.match[2] || 'undefined');
            else if (message.match[1] == 'user')
                throw new handler.UserError(message.match[2] || 'undefined');
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

};
