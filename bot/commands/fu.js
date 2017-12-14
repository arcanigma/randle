module.exports = function(controller, rng) {

    controller.hears( [/!fu/i], ['direct_message', 'direct_mention', 'mention', 'ambient'], function(bot, message) {
        bot.startTyping(message);

        var response;
        try {
            const answers = {
                1: {'phrase': '*no*, *and*...',  'color': '#E8E8E8'},
                2: {'phrase': '*no*.',           'color': '#C2D9E6'},
                3: {'phrase': '*no*, *but*...',  'color': '#9DCAE4'},
                4: {'phrase': '*yes*, *but*...', 'color': '#77BBE3'},
                5: {'phrase': '*yes*.',          'color': '#52ACE1'},
                6: {'phrase': '*yes*, *and*...', 'color': '#2C9EE0'},
            };

            var modifier = 0;
            var found = message.text.trim().match(/[+-][0-9]*/ig);
            if (found) found.forEach(function(element) {
                modifier += (parseInt(element) || (element == 0 ? 0 : parseInt(element + "1")));
            });
            var dice = 1 + Math.abs(modifier);

            var details = [];
            var rolls = [];
            for (let i = 1; i <= dice; i++) {
                let roll = rng(1, 6);
                rolls.push(roll);

                let phrase = answers[roll]['phrase'];
                let color = answers[roll]['color'];
                details.push({
                    'text': `${roll} → ${phrase}`,
                    'mrkdwn_in': ['text'],
                    'color': color
                });
            }
            rolls.sort();

            if (dice == 1) {
                let roll = rolls[0];
                let phrase = answers[roll]['phrase'];
                response = {
                    'response_type': 'in_channel',
                    'text': `<@${message.user}>, the answer is ${phrase}`,
                    'attachments': details
                };
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

                let extra = dice - 1;
                let cube = extra > 1 ? 'dice' : 'die';
                let phrase = answers[roll]['phrase'];
                response = {
                    'response_type': 'in_channel',
                    'text': `<@${message.user}>, with ${extra} ${type} ${cube}, the *${quality}* answer is ${phrase}`,
                    'attachments': details
                };
            }
        }
        catch(err){
            response = err;
        }

        bot.reply(message, response);
    });
}
