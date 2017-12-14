module.exports = function(controller, rng) {

    controller.hears( [/^!shuffle(.*)/i], ['direct_message', 'direct_mention', 'mention', 'ambient'], function(bot, message) {
        try {
            bot.startTyping(message);
            let shuffled = shuffleHelper(match[1]).join('*, *');
            bot.reply(message, {
                'text': `<@${message.user}>, you shuffled *${shuffled}*.`
            });
        }
        catch(err) {
            bot.whisper(message, {
                'text': `<@${message.user}>, your command caused an error. Please report it to the developer.`,
                'attachments': [{
                    'text': err.toString(),
                    'color': 'danger'
                }]
            });
        }
    });

    controller.hears( [/^!draw(.*)/i], ['direct_message', 'direct_mention', 'mention', 'ambient'], function(bot, message) {
        try {
            bot.startTyping(message);
            let element = shuffleHelper(match[1]).shift();
            bot.reply(message, {
                'text': `<@${message.user}>, you drew *${element}*.`
            });
        }
        catch(err) {
            bot.whisper(message, {
                'text': `<@${message.user}>, your command caused an error. Please report it to the developer.`,
                'attachments': [{
                    'text': err.toString(),
                    'color': 'danger'
                }]
            });
        }
    });

    function shuffleHelper(expression) {
        var elements = expression.trim().split(/\s*,\s*/);

        // TODO: duplicate on *N

        if (elements.length < 2)
            throw new Error('You must provide a comma-separated list of elements');

        rng.fyShuffle(elements);

        return elements;
    }
}
