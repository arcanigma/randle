const CONFIG = require('../config');

var randomInt = require('php-random-int'),
    regexClosure = require('../functions/regex-closure'),
    naturalCompare = require('string-natural-compare');

module.exports = function(controller, handler) {

    // HEAR ROLL COMMAND
    controller.hears(/^!?roll\b(.+)$/i, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        try {
            let clauses = [message.match[1]];

            let [results, attachments] = processDiceCodes(clauses, message);

            sendDiceResults(results, attachments, bot, message);
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    // HEAR PARENTHESES
    controller.hears(/\(([^'()][^()]*)\)/g, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        try {
            if (message.thread_ts) return;

            let clauses = [];
            for (let i = 0; i < message.match.length; i++)
                clauses[i] = message.match[i].slice(1, -1).trim();

            let [results, attachments] = processDiceCodes(clauses, message);

            sendDiceResults(results, attachments, bot, message);
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    // HEAR DIRECT MESSAGE OR MENTION
    controller.hears(/^(.+)$/, CONFIG.HEAR_EXPLICIT, function(bot, message) {
        try {
            let clauses = [message.text];

            let [results, attachments] = processDiceCodes(clauses, message);

            sendDiceResults(results, attachments, bot, message);
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    function sendDiceResults(results, attachments, bot, message) {
          if (results) {
              let name = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

              if (JSON.stringify(results).length <= CONFIG.MAX_MESSAGE)
                  bot.replyWithTyping(message, {
                      'text': `${name} rolled ${results}.`,
                      'attachments': attachments
                  });
              else
                  throw new Error(`Exceeded the ${CONFIG.MAX_MESSAGE} character message limit.`);
          }
          else if (CONFIG.HEAR_DIRECTLY.includes(message.type)) {
              bot.replyWithTyping(message, {
                  'text': 'Your message is unrecognized.'
              });
          }
    }

    // PROCESS DICE CODES
    function processDiceCodes(clauses, message) {
        const code = /(~|\b)([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?(?:(\*|\/|\||\\|\/\/|\\\\)([0-9]+(?:\.[0-9]+)?))?\b/ig;

        let attach = [],
            overflow = false;
        const fun = function(expr, avg, count, size, hilo, keep, mod, muldev, fact) {
            let expand = [];

            count = parseInt(count) || 1;
            size = (size != '%' ? parseInt(size) || 1 : 100);
            let rolls = [];
            let generate = (!avg ?
                randomInt :
                (low, high) => (low+high)/2
            );
            for (let i = 1; i <= count; i++)
                rolls.push(generate(1, size));

            let strikes = {};
            if (hilo) {
                keep = Math.min(parseInt(keep) || 1, count);

                let sorted = rolls.slice();
                if (hilo.toUpperCase() == 'L')
                    sorted.sort((x,y) => x-y);
                else
                    sorted.sort((x,y) => y-x);
                for (let i = keep; i < sorted.length; i++) {
                    let key = sorted[i].toString();
                    strikes[key] = (strikes[key] || 0) + 1;
                }
            }

            mod = parseFloat(mod) || 0;
            if (mod) rolls.push(mod);

            let atoms = [],
                total = 0;
            for (let i = 0; i < rolls.length; i++) {
                let roll = rolls[i],
                    key = roll.toString(),
                    face = Math.abs(roll),
                    sign = roll >= 0 ? '+' : '-';

                if (atoms.length > 0 || sign == '-')
                    atoms.push(sign);

                if (avg) face = `_${face}_`;

                if (!strikes[key]) {
                    total += roll;
                    atoms.push(face);
                }
                else {
                    strikes[key]--;
                    atoms.push(`~[${face}]~`);
                }
            }

            let color;
            if (avg)
                color = '#2C9EE0';
            else if (total == 1 * count + mod)
                color = 'danger';
            else if (total == size * count + mod)
                color = 'good';

            if (muldev) {
                fact = parseFloat(fact) || 1;

                if (atoms.length > 1)
                    atoms = ['(', ...atoms, ')'];

                if (muldev == '\*') {
                    atoms = [...atoms, '×', fact];
                    total *= fact;
                }
                else {
                    atoms = [...atoms, '÷', fact];
                    let quotient = total / fact,
                        fractional = !Number.isInteger(quotient);
                    if (muldev == '\/') {
                        if (fractional) atoms.push('rounded down');
                        total = Math.floor(quotient);
                    }
                    else if (muldev == '\|') {
                        if (fractional) atoms.push('rounded');
                        total = Math.round(quotient);
                    }
                    else if (muldev == '\\') {
                        if (fractional) atoms.push('rounded up');
                        total = Math.ceil(quotient);
                    }
                    else {
                        if (fractional) atoms.push('unrounded');
                        total = Math.round(quotient * 1000) / 1000;
                    }
                }
            }

            if (atoms.length > 1)
                atoms = [...atoms, '=', `*${total}*`];
            else if (atoms.length == 1)
                atoms[0] = `*${atoms[0]}*`;
            else
                atoms[0] = `_undefined_`;
            atoms = [`*${expr}*`, '→', ...atoms];

            if (attach.length < CONFIG.MAX_ATTACH)
                attach.push({
                    'text': atoms.join(' '),
                    'mrkdwn_in': ['text'],
                    'color': color
                });
            else overflow = true;

            return total;
        };

        let inline = [];
        for (let i = 0; i < clauses.length; i++) {
            let outcome = postProcess(
                preProcess(
                    expandMacros(clauses[i], message)
                ).replace(code, fun)
            );
            if (outcome != clauses[i])
                inline.push(outcome);
        }
        let results = inline.join('; ')
            .replace(/<[@#][\w|]+?>/, '')
            .replace(/^[\s.;,]+|[\s.;,]+$/, '')
            .replace(/\s+/, ' ');
        if (overflow)
            attach = [{
                'text': `You must roll *${CONFIG.MAX_ATTACH}* or fewer dice codes to see the roll details.`,
                'mrkdwn_in': ['text'],
                'color': 'warning'
            }];

        return [results, attach];
    }

    function expandMacros(content, message) {
        let custom = {};
        if (message.user_data && message.user_data.macros)
            custom = message.user_data.macros;

        let macros = Object.assign({
            'adv': '2d20H',
            'dis': '2d20L'
        }, custom);

        for (let name in macros)
            content = content.replace(new RegExp(`\\b${name}\\b`, 'ig'), macros[name]);

        return content;
    }

    function preProcess(content) {
        content = evaluateArithmeticOps(content);
        content = expandRepsArrays(content);

        return content;
    }

    function postProcess(content) {
        content = evaluateArithmeticOps(content);
        content = evaluateComparisonOps(content);
        content = applyNumberBolding(content);

        return content;
    }

    function evaluateArithmeticOps(content) {
        const re = /([+-]|\b)([0-9]+(?:\.[0-9]+)?)\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\b/;
        const fun = function (_, sign, x, op, y) {
            x = parseFloat(sign+x);
            y = parseFloat(op+y);
            let sum = x+y;
            if (sign && sum >= 0)
                return '+' + sum;
            else
                return sum.toString();
        };

        return regexClosure(content, re, fun);
    }

    function expandRepsArrays(content) {
        const re = /^([\s\S]+?)\.\.\.([\w\s]+(?:,[\w\s]+)*)$/;
        const fun = function(_, phrase, list) {
            phrase = phrase.trim();

            let atoms = [],
                elements = list.split(','),
                reps = parseInt(elements[0]);
            if (elements.length == 1 && reps > 0) {
                for (let i = 1; i <= reps; i++)
                    atoms.push(phrase);
            }
            else {
                for (let i = 0; i < elements.length; i++)
                    atoms.push(`${phrase} ← ${elements[i].trim()}`);
            }

            return atoms.join(', ');
        };

        return content.replace(re, fun);
    }

    function evaluateComparisonOps(content) {
        const re = /([0-9]+(?:\.[0-9]+)?)\s*(=|==|&gt;|&lt;|&gt;=|=&gt;|&lt;=|=&lt;|!=|&lt;&gt;|&gt;&lt;)\s*([0-9]+(?:\.[0-9]+)?)/g;
        const fun = function(_, x, relop, y) {
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

            let answer = `${x} [*${flag ? 'Yes' : 'No'}*]`;

            return answer;
        };

        return content.replace(re, fun);
    }

    function applyNumberBolding(content) {
        const re = /\b[0-9]+(?:\.[0-9]+)?(?!:)\b/g;

        return content.replace(re, '*$&*');
    }

};
