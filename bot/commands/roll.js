var randomInt = require('random-int');
var regexReduce = require('regex-reduce');

const MAX_ATTACH = 10;

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
    var regexReduceArithmetic = function(text) {
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

        return regexReduce(text, re, fun);
    };
    controller.middleware.receive.use(function(bot, message, next) {
        if (RECEIVE_TYPES.includes(message.type)) {
            try {
                message.text = regexReduceArithmetic(message.text);
            }
            catch(err) {
                handler.error(bot, message, err);
            }
        }
        next();
    });

    // PROCESS DICE CODES
    // TODO

    // POST-PROCESS ARITHMETIC
    controller.middleware.send.use(function(bot, message, next) {
        try {
            message.text = regexReduceArithmetic(message.text);
        }
        catch(err) {
            handler.error(bot, message, err);
        }
        next();
    });

    // POST-PROCESS BOUNDS
    controller.middleware.send.use(function(bot, message, next) {
        try {
            const re = /([0-9]+)\s*(=|==|&gt;|&lt;|&gt;=|=&gt;|&lt;=|=&lt;|!=|&lt;&gt;|&gt;&lt;)\s*([0-9]+)/g;
            const fun = function(match, x, relop, y) {
                x = parseInt(x);
                y = parseInt(y);

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
            const re = /\b[0-9]+(?!:)\b/g;

            message.text = message.text.replace(re, '*$&*');
        }
        catch(err) {
            handler.error(bot, message, err);
        }
        next();
    });

};
