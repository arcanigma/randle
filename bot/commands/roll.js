var randomInt = require('random-int');
var regexReduce = require('regex-reduce');

const MAX_ATTACH = 10;

const RECEIVE_TYPES = ['direct_message', 'direct_mention', 'mention', 'ambient'];

module.exports = function(controller, handler) {

    // PRE-PROCESS MACRO REPLACEMENTS
    controller.middleware.receive.use(function(bot, message, next) {
        const MACROS = {
            '/adv': '2d20H',
            '/a':   '2d20H',
            '/r':   '1d20',
            '/dis': '2d20L',
            '/d':   '2d20L',
            'd%':   'd100',
            'TEST': '41'
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

    // PRE-PROCESS ARITHMETIC
    var arithmeticHandler = function(bot, message, next) {
        try {
            const re = /([+-]|\b)([0-9]+)\s*([+-])\s*([0-9]+)\b/;
            const fun = function (match, sign, x, op, y) {
                x = parseInt(sign+x);
                y = parseInt(op+y);
                let sum = x+y;
                if (sign && sum >= 0)
                    return '+' + sum;
                else
                    return sum.toString();
            };

            message.text = regexReduce(message.text, re, fun);
        }
        catch(err) {
            handler.error(bot, message, err);
        }
        next();
    };
    controller.middleware.receive.use(function(bot, message, next) {
        if (RECEIVE_TYPES.includes(message.type)) {
            arithmeticHandler(bot, message, next);
        }
    });

    // TODO: ROLLS

    // POST-PROCESS ARITHMETIC
    controller.middleware.send.use(arithmeticHandler);

    // POST-PROCESS BOUNDS CHECKS

    // POST-PROCESS FUNCTIONS

    // BOLD ALL NUMBERS, EXCEPT IN EMOJI
    controller.middleware.send.use(function(bot, message, next) {
        const re = /\b[0-9]+(?!:)\b/g;

        try {
            message.text = message.text.replace(re, '*$&*');
        }
        catch(err) {
            handler.error(bot, message, err);
        }
        next();
    });

};
