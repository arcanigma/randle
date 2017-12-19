var randomInt = require('random-int');
var regexReduce = require('regex-reduce');

const MAX_ATTACH = 15,
      MAX_CHARS = 100;

const RECEIVE_TYPES = ['direct_message', 'direct_mention', 'mention', 'ambient'];

module.exports = function(controller, handler) {

    // PRE-PROCESS MACROS
    controller.middleware.receive.use(function(bot, message, next) {
        const MACROS = {
            '/adv': '2d20H',
            '/a':   '2d20H',
            '/r':   '1d20',
            '/dis': '2d20L',
            '/d':   '2d20L',
            'd%':   'd100'
        };

        if (RECEIVE_TYPES.includes(message.type)) {
            try {
                for (let macro in MACROS) {
                    message.text = message.text.replace(macro, MACROS[macro]);
                }
            }
            catch(err) {
                handler.error(bot, message, err);
            }
        }
        next();
    });

    // PRE-PROCESS ADDITION AND SUBTRACTION
    var regexReduceAddSub = function(text) {
        const re = /([+-]|\b)([0-9]+(?:\.[0-9]+)?)\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\b/;
        const fun = function (match, sign, x, op, y) {
            x = parseFloat(sign+x);
            y = parseFloat(op+y);
            let sum = x+y;
            if (sign && sum >= 0)
                return '+' + sum;
            else
                return sum.toString();
        };

        return regexReduce(text, re, fun);
    };
    controller.middleware.receive.use(function(bot, message, next) {
        if (RECEIVE_TYPES.includes(message.type)) {
            try {
                message.text = regexReduceAddSub(message.text);
            }
            catch(err) {
                handler.error(bot, message, err);
            }
        }
        next();
    });

    // PROCESS DICE CODES
    const parens = /\(([^()]+)\)/g;
    controller.hears(parens, ['direct_message', 'direct_mention', 'mention', 'ambient'], function(bot, message) {
        const code = /(\B~)?(([1-9][0-9]*)?d([1-9][0-9]*)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?(?:(\*|\/|\||\\|\/\/)([0-9]+(?:\.[0-9]+)?))?)(?:(\^)([1-9][0-9]*))?\b/ig;

        try {
            bot.startTyping(message);

            let attach = [],
                inline = [],
                overflow = 0;
            const fun = function(match, avg, slug, count, size, hilo, keep, mod, muldev, fact, times, reps) {
                let expand = [];

                count = parseInt(count) || 1;
                size = parseInt(size) || 1;
                mod = parseFloat(mod) || 0;

                fact = parseFloat(fact) || 1;
                let trans;
                if (muldev) {
                    if (muldev == '\*')
                        trans = x => x * fact;
                    else if (muldev == '\/')
                        trans = x => Math.floor(x / fact);
                    else if (muldev == '\|')
                        trans = x => Math.round(x / fact);
                    else if (muldev == '\\')
                        trans = x => Math.ceil(x / fact);
                    else
                        trans = x => Math.round(x / fact * 1000) / 1000;
                }
                else {
                    trans = x => x;
                }

                reps = (times ? parseInt(reps) : 1);
                for (let rep = 1; rep <= reps; rep++) {
                    if (avg) {
                        // if (hilo) {
                        //     expansion.push('_error_');
                        //     attach.push({
                        //         'text': `*${slug}* → Keeping high/low is not allowed in averages.`,
                        //         'mrkdwn_in': ['text'],
                        //         'color': 'warning'
                        //     });
                        // }
                        //
                        // if (times) {
                        //     expansion.push('_error_');
                        //     attach.push({
                        //         'text': `*${slug}* → Repetition is not allowed in averages.`,
                        //         'mrkdwn_in': ['text'],
                        //         'color': 'warning'
                        //     });
                        // }

                        let average = trans((count * ((1 + size) / 2)) + mod);
                        expand.push(average);
                        if (attach.length < MAX_ATTACH)
                            attach.push({
                                'text': `*${slug}* ≈ ${average}`,
                                'mrkdwn_in': ['text'],
                                'color': '#439FE0'
                            });
                        else overflow++;
                    }
                    else {
                        expand.push('_unknown_');
                        if (attach.length < MAX_ATTACH)
                            attach.push({
                                'text': `*${slug}* → Not yet implemented.`,
                                'mrkdwn_in': ['text'],
                                'color': 'warning'
                            });
                        else overflow++;
                    }
                }

                return expand.join(', ');
            };

            let match;
            while ((match = parens.exec(message.text)) != null) {
                let content = match[1],
                    old = content;
                content = content.replace(code, fun);
                if (content != old)
                    inline.push(content);
            }

            let results = inline.join('; ');
            if (results.length > MAX_CHARS) {
                attach.push({
                    'text': `Message too long. Only showing the first _${MAX_CHARS}_ of _${results.length}_ characters.`,
                    'mrkdwn_in': ['text'],
                    'color': 'warning'
                });
                results = results.substring(0, MAX_CHARS) + '...';
            }

            if (overflow > 0) {
                attach.push({
                    'text': `Too many results. Only showing the first _${MAX_ATTACH}_ of _${MAX_ATTACH+overflow}_ details.`,
                    'mrkdwn_in': ['text'],
                    'color': 'warning'
                });
            }

            if (results) {
                bot.reply(message, {
                    'response_type': 'in_channel',
                    'text': `<@${message.user}> rolled ${results}.`,
                    'attachments': attach
                });
            }
        }
        catch(err) {
            handler.error(bot, message, err);
        }
    });

    // POST-PROCESS ADDITION AND SUBTRACTION
    controller.middleware.send.use(function(bot, message, next) {
        try {
            message.text = regexReduceAddSub(message.text);
        }
        catch(err) {
            handler.error(bot, message, err);
        }
        next();
    });

    // POST-PROCESS BOUNDS
    controller.middleware.send.use(function(bot, message, next) {
        try {
            const re = /([0-9]+(?:\.[0-9]+)?)\s*(=|==|&gt;|&lt;|&gt;=|=&gt;|&lt;=|=&lt;|!=|&lt;&gt;|&gt;&lt;)\s*([0-9]+(?:\.[0-9]+)?)/g;
            const fun = function(match, x, relop, y) {
                x = parseFloat(x);
                y = parseFloat(y);

                let flag;
                if (relop == '=' || relop == '==')
                    flag = (x == y);
                else if (relop == '&gt;')
                    flag = (x > y);
                else if (relop == '&lt;')
                    flag = (x < y);
                else if (relop == '&gt;=' || relop == '=&gt;')
                    flag = (x >= y);
                else if (relop == '&lt;=' || relop == '=&lt;')
                    flag = (x <= y);
                else if (relop == '!=' || relop == '&lt;&gt;' || relop == '&gt;&lt;')
                    flag = (x != y);

                let answer = `${x} [_*${flag ? 'Yes' : 'No'}*_]`;

                return answer;
            };

            message.text = message.text.replace(re, fun);
        }
        catch(err) {
            handler.error(bot, message, err);
        }
        next();
    });

    // POST-PROCESS FUNCTIONS
    // TODO

    // POST-PROCESS NUMBER BOLDING
    controller.middleware.send.use(function(bot, message, next) {
        try {
            const re = /\b[0-9]+(?:\.[0-9]+)?(?!:)\b/g;

            message.text = message.text.replace(re, '*$&*');
        }
        catch(err) {
            handler.error(bot, message, err);
        }
        next();
    });

};
