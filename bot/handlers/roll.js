const CONFIG = require('../config');
var randomInt = require('php-random-int'),
    regexReduce = require('../functions/regex-reduce'),
    naturalCompare = require('string-natural-compare');

module.exports = function(controller, handler) {

    // PROCESS DICE CODES
    const parens = /\(([^'()][^()]*)\)/g;
    const code = /(~|\b)([1-9][0-9]*)?d([1-9][0-9]*)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?(?:(\*|\/|\||\\|\/\/|\\\\)([0-9]+(?:\.[0-9]+)?))?\b/ig;
    const lead = /^[!/]?roll(?:s|ed|ing)?(?:[\s.;,]+|\b)(.*?)(?:[\s.;,]*)$/i;
    controller.hears([lead, parens, code], CONFIG.HEAR_ANYWHERE, function(bot, message) {
        try {
            let clauses;
            if (message.match[0].match(lead)) {
                clauses = [message.match[1]];
            }
            else {
                if (message.match[0].startsWith('(')) {
                    clauses = [];
                    for (let i = 0; i < message.match.length; i++)
                        clauses[i] = message.match[i].slice(1, -1).trim();
                }
                else if (CONFIG.HEAR_EXPLICIT.includes(message.type)) {
                    clauses = [`!roll ${message.text}`.match(lead)[1]];
                }
                else return;
            }

            let attach = [];
            const fun = function(expr, avg, count, size, hilo, keep, mod, muldev, fact) {
                let expand = [];

                count = parseInt(count) || 1;
                size = parseInt(size) || 1;
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

                let text = atoms.join(' ');
                if (attach.length < CONFIG.MAX_ATTACH)
                    attach.push({
                        'text': text,
                        'mrkdwn_in': ['text'],
                        'color': color
                    });
                else throw new Error(`Exceeded the ${CONFIG.MAX_ATTACH} roll limit.`);

                return total;
            };

            let inline = [];
            for (let i = 0; i < clauses.length; i++) {
                let content = preProcess(clauses[i]),
                    old = content;
                content = content.replace(code, fun);
                if (content != old)
                    inline.push(postProcess(content));
            }
            let results = inline.join('; ')
                .replace(/<[@#].*?>/, '')
                .replace(/[\s.;,]+$/, '')
                .replace(/\s+/, ' ');

            let response = {
                'text': `<@${message.user}> rolled ${results}.`,
                'attachments': attach
            };

            if (results) {
                if (JSON.stringify(results).length <= CONFIG.MAX_MESSAGE) {
                    bot.replyWithTyping(message, response);
                }
                else throw new Error(`Exceeded the ${CONFIG.MAX_MESSAGE} character message limit.`);
            }
        }
        catch(err) {
            handler.error(bot, message, err);
        }
    });

    // PRE-PROCESS PARENTHETICAL CONTENT
    function preProcess(content) {
        content = expandMacros(content);
        content = reduceArithmeticOps(content);
        content = expandRepsArrays(content);

        return content;
    }

    // POST-PROCESS PARENTHETICAL CONTENT
    function postProcess(content) {
        content = reduceArithmeticOps(content);
        content = evaluateComparisonOps(content);
        content = evaluateFunctions(content);
        content = applyNumberBolding(content);

        return content;
    }

    function expandMacros(content) {
        // TODO: register custom macros

        return content.replace(/\badv\b/i, '2d20H')
                      .replace(/\bdis\b/i, '2d20L')
                      .replace(/d%/i, 'd100');
    }

    function reduceArithmeticOps(content) {
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

        return regexReduce(content, re, fun);
    }

    function expandRepsArrays(content) {
        const re = /^(.+?)\.\.\.([\w ]+(?:,[\w ]+)*)$/;
        const fun = function(match, phrase, list) {
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

            let answer = `${x} [*${flag ? 'Yes' : 'No'}*]`;

            return answer;
        };

        return content.replace(re, fun);
    }

    // TODO: implement function evaluation
    function evaluateFunctions(content) {
        return content;
    }

    function applyNumberBolding(content) {
        const re = /\b[0-9]+(?:\.[0-9]+)?(?!:)\b/g;

        return content.replace(re, '*$&*');
    }

};
