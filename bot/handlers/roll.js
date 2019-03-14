const CONFIG = require('../config');

var randomInt = require('php-random-int'),
    regexClosure = require('../functions/regex-closure'),
    naturalCompare = require('string-natural-compare'),
    toOrdinal = require('ordinal');

module.exports = function(controller, handler) {

    // HEAR ROLL COMMAND
    controller.hears(/^!?roll\b(.+)$/i, CONFIG.HEAR_ANYWHERE, function(bot, message) {
        try {
            let clauses = [message.match[1]];

            let [summary, blocks] = processDiceCodes(clauses, message);

            sendDiceResults(summary, blocks, bot, message);
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
                clauses.push(...cloneEllipses(message.match[i].slice(1, -1).trim()));

            let [summary, blocks] = processDiceCodes(clauses, message);

            sendDiceResults(summary, blocks, bot, message);
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    // HEAR DIRECT MESSAGE OR MENTION
    controller.hears(/^(.+)$/, CONFIG.HEAR_EXPLICIT, function(bot, message) {
        try {
            let clauses = [message.text];

            let [summary, blocks] = processDiceCodes(clauses, message);

            sendDiceResults(summary, blocks, bot, message);
        }
        catch(err) {
            handler.error(err, bot, message);
        }
    });

    function sendDiceResults(summary, blocks, bot, message) {
          if (blocks) {
              let name = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

              let reply = {
                  'text': `${name} rolled ${summary}.`,
                  'blocks': blocks
              };

              if (JSON.stringify(reply).length <= CONFIG.MAX_REPLY_SIZE)
                  bot.replyWithTyping(message, reply);
              else
                  throw new handler.UserError('Your command was too long to answer.');
          }
    }

    // PROCESS DICE CODES
    function processDiceCodes(clauses, message) {
        let elements;
        const code = /(~|\b)([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?(?:(\*|\/|\||\\)([0-9]+(?:\.[0-9]+)?))?\b/ig;
        const fun = function(expr, avg, count, size, hilo, keep, mod, muldev, fact) {
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

            let prefix;
            if (avg)
                prefix = ':bar_chart:';
            else if (total == 1 * count + mod)
                prefix = ':heavy_multiplication_x:';
            else if (total == size * count + mod)
                prefix = ':heavy_check_mark:';
            else
                prefix = ':white_square:';

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
                        if (fractional) atoms.push('rounded naturally');
                        total = Math.round(quotient);
                    }
                    else if (muldev == '\\') {
                        if (fractional) atoms.push('rounded up');
                        total = Math.ceil(quotient);
                    }
                }
            }

            if (atoms.length > 1)
                atoms = [...atoms, '=', `*${total}*`];
            else if (atoms.length == 1)
                atoms[0] = `*${atoms[0]}*`;
            else
                atoms[0] = `_undefined_`;
            atoms = [`*${expr}:*`, ...atoms];

            const MAX_ELEMENTS = 10;
            if (elements.length < MAX_ELEMENTS - 1) {
                elements.push({
                    'type': 'mrkdwn',
                    'text': `${prefix} ${atoms.join(' ')}`
                });
            }
            else if (elements.length == MAX_ELEMENTS - 1) {
                elements.push({
                    'type': 'mrkdwn',
                    'text': `:warning: Too many rolls to show.`
                });
            }

            return total;
        };

        let phrases = [];
        let blocks = [];
        for (let i = 0; i < clauses.length; i++) {
            elements = [];
            let outcome = postProcessChain(preProcessChain(clauses[i], message).replace(code, fun), message);

            if (outcome != clauses[i]) {
                phrases.push(outcome);

                if (blocks.length == 0) {
                    let name = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

                    blocks.push({
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': `${name} rolled ${outcome}.`
                          }
                    });
                }
                else {
                    // blocks.push({
                    //     'type': 'divider'
                    // });
                    blocks.push({
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': `Then ${outcome}.`
                          }
                    });
                }
                blocks.push({
                    'type': 'context',
                    'elements': elements
                });
            }
        }

        let summary = phrases.join('; ')
            .replace(/<[@#][\w|]+?>/, '')
            .replace(/^[\s.;,]+|[\s.;,]+$/, '')
            .replace(/\s+/, ' ');

        return [summary, blocks];
    }

    function cloneEllipses(clause) {
        const re = /^(.+)\s*\.\.\.\s*(\w+(?:\s*,\s*\w+)*)$/;
        let match = clause.trim().match(re);

        if (match) {
            let phrase = match[1].trim(),
                over = match[2].trim().split(/\s*,\s*/),
                reps = parseInt(over[0]);
            let clones = [];
            if (over.length == 1 && reps >= 1) {
                for (let i = 1; i <= reps; i++)
                    clones.push(`${phrase} on the ${toOrdinal(i)} roll`);
            }
            else {
                for (let i = 0; i < over.length; i++)
                    clones.push(`${phrase} for ${over[i]}`);
            }
            return clones;
        }
        else {
            return [clause];
        }
    }

    function preProcessChain(content, message) {
        content = evaluateMacros(content, message);
        content = evaluateArithmeticOps(content);

        return content;
    }

    function postProcessChain(content, message) {
        content = evaluateArithmeticOps(content);
        content = evaluateComparisonOps(content);
        content = applyNumberBolding(content);

        return content;
    }

    function evaluateMacros(content, message) {
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
        // TODO: in ES9 add lookbehind (?<![#_*])
        const re = /\b[0-9]+(?:\.[0-9]+)?(?![:_*])\b/g;

        return content.replace(re, '*$&*');
    }

};
