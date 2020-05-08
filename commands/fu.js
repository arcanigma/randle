const randomInt = require('php-random-int');

const { who, blame} = require('../plugins/factory.js'),
      { anywhere } = require('../plugins/listen.js');

module.exports = (app) => {

    const MAX_DICE = 10;

    const ANSWERS = {
        1: { phrase: '*no*, *and*...',  'color': '#E8E8E8' },
        2: { phrase: '*no*.',           'color': '#C2D9E6' },
        3: { phrase: '*no*, *but*...',  'color': '#9DCAE4' },
        4: { phrase: '*yes*, *but*...', 'color': '#77BBE3' },
        5: { phrase: '*yes*.',          'color': '#52ACE1' },
        6: { phrase: '*yes*, *and*...', 'color': '#2C9EE0' },
    };

    const re_fu = /^!?fu\s+(.+)/i;
    app.message(anywhere, re_fu, async ({ message, context, say }) => {
        try {
            var modifier = 0;
            const re_number = /[+-][0-9]*/ig;
            var found = context.matches[1].match(re_number);
            if (found) found.forEach(function(element) {
                modifier += (parseInt(element) || (element === 0 ? 0 : parseInt(element + "1")));
            });
            var dice = 1 + Math.abs(modifier);
            if (dice > MAX_DICE)
                return await say(blame(`You can roll at most ${MAX_DICE} dice.`));

            var attach = [];
            var rolls = [];
            for (let i = 1; i <= dice; i++) {
                let roll = randomInt(1, 6);
                rolls.push(roll);

                let phrase = ANSWERS[roll].phrase;
                let color = ANSWERS[roll].color;

                // TODO: refactor legacy attachments into blocks
                attach.push({
                    text: `${roll} → ${phrase}`,
                    mrkdwn_in: ['text'],
                    color: color
                });
            }
            rolls.sort();

            if (dice == 1) {
                let roll = rolls[0];
                let phrase = ANSWERS[roll].phrase;
                say ({
                    text: `The answer for ${who(message, 'you')} is ${phrase}`,
                    attachments: attach
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

                // TODO respond within thread
                say({
                    text: `The *${quality}* answer for ${who(message, 'you')} with ${extra} ${type} ${cube} is ${phrase}`,
                    attachments: attach
                });
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

};
