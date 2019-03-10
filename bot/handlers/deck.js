const CONFIG = require('../config');

var fyShuffle = require('../functions/fisher-yates-shuffle');

module.exports = function(controller, handler) {

    controller.hears(/^!?shuffle\b(.*)/i, ['direct_message', 'direct_mention', 'mention', 'ambient'], function(bot, message) {
        try {
            bot.startTyping(message);
            let shuffled = shuffleHelper(message.match[1]).join('*, *');

            let name = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            bot.replyWithTyping(message, {
                'text': `${name} shuffled *${shuffled}*.`
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

            let name = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            bot.replyWithTyping(message, {
                'text': `${name} drew *${element}*.`
            });
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    function shuffleHelper(expression) {
        var elements = expression.trim().split(/\s*,\s*/);

        if (elements.length < 2)
            throw new Error('You must provide at least two elements separated by commas.');

        fyShuffle(elements);

        return elements;
    }

};
