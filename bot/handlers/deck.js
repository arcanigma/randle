const CONFIG = require('../config');

var fyShuffle = require('../functions/fisher-yates-shuffle');

module.exports = function(controller, handler) {

    controller.hears(/^!?shuffle\b(.*)/i, ['direct_message', 'direct_mention', 'mention', 'ambient'], function(bot, message) {
        try {
            bot.startTyping(message);
            let shuffled = shuffleHelper(message.match[1]).join('*, *');

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            bot.replyWithTyping(message, {
                'text': `${who} shuffled *${shuffled}*.`
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    controller.hears( /^!?draw\b(.*)/i, ['direct_message', 'direct_mention', 'mention', 'ambient'], function(bot, message) {
        try {
            bot.startTyping(message);
            let element = shuffleHelper(message.match[1]).shift();

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            bot.replyWithTyping(message, {
                'text': `${who} drew *${element}*.`
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    function shuffleHelper(expression) {
        var elements = expression.trim().split(/\s*,\s*/);

        if (elements.length < 2)
            throw new handler.UserError('You must list at least two items separated by commas.');

        fyShuffle(elements);

        return elements;
    }

};
