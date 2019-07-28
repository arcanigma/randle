const CONFIG = require('../config'),
      randomInt = require('php-random-int');

module.exports = function(controller) {

    controller.hears(/^!?shuffle\b(.*)/i, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            let shuffled = shuffleHelper(message.matches[1]).join('*, *');
            if (shuffled.length < 2)
                await controller.plugins.handler.raise('You must list at least two items separated by commas.');

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            await bot.reply(message, {
                'text': `${who} shuffled *${shuffled}*.`
            });
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    controller.hears(/^!?draw\b(.*)/i, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            let element = shuffleHelper(message.matches[1]).shift();
            if (shuffled.length < 2)
                await controller.plugins.handler.raise('You must list at least two items separated by commas.');

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            await bot.reply(message, {
                'text': `${who} drew *${element}*.`
            });
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    function shuffleHelper(expression) {
        let elements = expression.trim().split(/\s*,\s*/).filter(Boolean);
        shuffleWithFisherYates(elements);
        return elements;
    }

    function shuffleWithFisherYates(array) {
        for (let i = array.length-1; i >= 1; i--) {
            let j = randomInt(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
    };

};
