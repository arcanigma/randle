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

    // PRE-PROCESS +/- ARITHMETIC REDUCER
    controller.middleware.receive.use(function(bot, message, next) {
        processMessage(bot, message, next, function() {
            const re = /([+-])\s*([0-9]+)\s*([+-])\s*([0-9]+)/;
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
    });

};
