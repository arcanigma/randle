const CONFIG = require('../config');

module.exports = function(controller, handler) {

    controller.hears(/^!?echo\b(.*)/, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        try {
            bot.replyWithTyping(message, message.match[1].trim());
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

};
