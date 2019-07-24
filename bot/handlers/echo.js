const CONFIG = require('../config');

module.exports = function(controller, handler) {

    controller.hears(/^!?echo\b(.*)/i, CONFIG.HEAR_EXPLICIT, async(bot, message) => {
        try {
            await bot.reply(message, message.matches[1].trim());
        }
        catch(err) {
            await handler.error(err, bot, message);
        }
    });

    controller.hears(/^!?throw\s+(system|user)\s+error\b(.*)/i, CONFIG.HEAR_EXPLICIT, async(bot, message) => {
        try {
            if (message.matches[1] == 'system')
                throw new Error(message.matches[2] || 'undefined');
            else if (message.matches[1] == 'user')
                throw new handler.UserError(message.matches[2] || 'undefined');
        }
        catch(err) {
            await handler.error(err, bot, message);
        }
    });

};
