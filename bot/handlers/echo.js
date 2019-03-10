const CONFIG = require('../config');

module.exports = function(controller) {

    controller.hears(/^!?echo\b(.*)/, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        bot.replyWithTyping(message, message.match[1]);
    });

};
