const CONFIG = require('../config'),
      { UserError } = require('../errors'),
      fyShuffle = require('../functions/fisher-yates-shuffle');

module.exports = function(controller) {

    controller.hears(/^!?shuffle\b(.*)/i, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            let shuffled = shuffleHelper(message.matches[1]).join('*, *');

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            await bot.reply(message, {
                'text': `${who} shuffled *${shuffled}*.`
            });
        }
        catch(err) {
            await controller.handle(err, bot, message);
        }
    });

    controller.hears(/^!?draw\b(.*)/i, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            let element = shuffleHelper(message.matches[1]).shift();

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            await bot.reply(message, {
                'text': `${who} drew *${element}*.`
            });
        }
        catch(err) {
            await controller.handle(err, bot, message);
        }
    });

    function shuffleHelper(expression) {
        var elements = expression.trim().split(/\s*,\s*/);

        if (elements.length < 2)
            throw new UserError('You must list at least two items separated by commas.');

        fyShuffle(elements);

        return elements;
    }

};
