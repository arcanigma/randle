var randomInt = require('random-int');
var regexReduce = require('regex-reduce');

const MAX_ATTACH = 10;

module.exports = function(controller, handler) {

    var processMessage = function(bot, message, next, callback) {
        if (['direct_message', 'direct_mention', 'mention', 'ambient'].includes(message.type)) {
            try {
                callback();
            }
            catch(err) {
                handler.error(bot, message, err);
            }
        }
        next();
    };

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

        processMessage(bot, message, next, function() {
            for (let macro in MACROS) {
                message.text = message.text.replace(macro, MACROS[macro]);
            }
        });
    });

    // PRE- AND POST-PROCESS +/- ARITHMETIC
    var arithmeticHandler = function(bot, message, next) {
        processMessage(bot, message, next, function() {
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
        });
    };
    controller.middleware.receive.use(arithmeticHandler);
    // controller.middleware.send.use(arithmeticHandler);

};
