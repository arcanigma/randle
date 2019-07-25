const CONFIG = require('../config'),
      randomInt = require('php-random-int');

module.exports = function(controller) {

    const MAX_DICE = 10;

    const ANSWERS = {
        1: {'phrase': '*no*, *and*...',  'color': '#E8E8E8'},
        2: {'phrase': '*no*.',           'color': '#C2D9E6'},
        3: {'phrase': '*no*, *but*...',  'color': '#9DCAE4'},
        4: {'phrase': '*yes*, *but*...', 'color': '#77BBE3'},
        5: {'phrase': '*yes*.',          'color': '#52ACE1'},
        6: {'phrase': '*yes*, *and*...', 'color': '#2C9EE0'},
    };

    controller.hears(/^!?fu\b(.*)/i, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        try {
            var modifier = 0;
            var found = message.matches[1].match(/[+-][0-9]*/ig);
            if (found) found.forEach(function(element) {
                modifier += (parseInt(element) || (element === 0 ? 0 : parseInt(element + "1")));
            });
            var dice = 1 + Math.abs(modifier);
            if (dice > MAX_DICE)
                await controller.plugins.handler.raise(`You can roll at most ${MAX_DICE} dice.`);

            var attach = [];
            var rolls = [];
            for (let i = 1; i <= dice; i++) {
                let roll = randomInt(1, 6);
                rolls.push(roll);

                let phrase = ANSWERS[roll].phrase;
                let color = ANSWERS[roll].color;
                // TODO: refactor legacy attachments into blocks
                attach.push({
                    'text': `${roll} → ${phrase}`,
                    'mrkdwn_in': ['text'],
                    'color': color
                });
            }
            rolls.sort();

            let whose = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>'s` : 'Your';

            if (dice == 1) {
                let roll = rolls[0];
                let phrase = ANSWERS[roll].phrase;
                bot.replyWithTyping(message, {
                    'response_type': 'in_channel',
                    'text': `${whose} answer is ${phrase}`,
                    'attachments': attach
                });
            }
            else {
                let roll, type, quality;
                if (modifier > 0) {
                    roll = rolls.pop();
                    type = 'bonus';
                    quality = 'best';
                }
                else {
                    roll = rolls.shift();
                    type = 'penalty';
                    quality = 'worst';
                }

                let phrase = ANSWERS[roll].phrase;
                let extra = dice - 1;
                let cube = extra > 1 ? 'dice' : 'die';

                bot.replyWithTyping(message, {
                    'text': `${whose} *${quality}* answer with ${extra} ${type} ${cube} is ${phrase}`,
                    'attachments': attach
                });
            }
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

};
