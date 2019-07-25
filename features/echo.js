const CONFIG = require('../config');

module.exports = function(controller) {

    controller.hears(/^!?echo\b(.*)/i, CONFIG.HEAR_EXPLICIT, async(bot, message) => {
        try {
            await bot.reply(message, message.matches[1].trim());
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    controller.hears(/^!?throw\s+(system|user)\s+error\b(.*)/i, CONFIG.HEAR_EXPLICIT, async(bot, message) => {
        try {
            if (message.matches[1] == 'system')
                throw new Error(message.matches[2] || 'undefined');
            else if (message.matches[1] == 'user')
                await controller.plugins.handler.raise(message.matches[2] || 'undefined');
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

};
