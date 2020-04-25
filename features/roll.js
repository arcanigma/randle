const CONFIG = require('../config'),
      randomInt = require('php-random-int'),
      naturalCompare = require('string-natural-compare'),
      toOrdinal = require('ordinal');

const { who, blame} = require('../plugins/factory.js');
const { no_thread, anywhere, direct, limit } = require('../plugins/listen.js');

module.exports = (app) => {

    const re_roll = /^!?roll\b(.+)$/i;
    app.message(anywhere, re_roll, limit, async ({ message, context, say }) => {
        // await controller.plugins.macros.prepare(message, command);

        try {
            let clauses = [context.matches[1]];

            let [summary, blocks] = processDiceCodes(clauses, message);

            await sendDiceResults(app, message, context, summary, blocks);
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_parens = /\(([^'()][^()]*)\)/g;
    app.message(no_thread, anywhere, re_parens, limit, async ({ message, context, say }) => {
        // await controller.plugins.macros.prepare(message, parens);

        try {
            let clauses = [];
            for (let i = 0; i < context.matches.length; i++)
                clauses.push(...cloneEllipses(context.matches[i].slice(1, -1)));

            let [summary, blocks] = processDiceCodes(clauses, message);

            await sendDiceResults(app, message, context, summary, blocks);
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_any = /^(.+)$/;
    app.message(direct, re_any, limit, async ({ message, context, say }) => {
        // await controller.plugins.macros.prepare(message, any);

        try {
            let clauses = [message.text];

            let [summary, blocks] = processDiceCodes(clauses, message);

            // TODO make sure length check works with macros
            if (blocks.length > 0)
                await sendDiceResults(app, message, context, summary, blocks);
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    async function sendDiceResults(app, message, context, summary, blocks) {
        if (!summary)
            summary = message.text;

        let reply = {
            'text': `${who('You', message)} rolled ${summary}.`,
            'blocks': blocks
        };

        if (JSON.stringify(reply).length > CONFIG.MAX_REPLY_SIZE)
            reply = blame('The result was too long to send.');

        reply.token = context.botToken;
        reply.channel = message.channel;
        if (message.thread_ts)
            reply.thread_ts = message.thread_ts;

        await app.client.chat.postMessage(reply);
    }

    function cloneEllipses(clause) {
        const re_ellipsis = /^\s*(.+)\s*\.\.\.\s*(\w+(?:\s*,\s*\w+)*)\s*$/;
        let match = clause.match(re_ellipsis);
        if (match) {
            const re_trail = /^[\s.;,]+|[\s.;,]+$/g,
                  re_sep = /\s*,\s*/;
            let phrase = match[1].replace(re_trail, ''),
                over = match[2].split(re_sep),
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

    function processDiceCodes(clauses, message) {
        let elements;
        let maxed;

        const re_code = /(~|\b)([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?(?:(\*|\/|\||\\)([0-9]+(?:\.[0-9]+)?))?\b/ig;
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
            else if (total == 1 * (!hilo ? count : keep) + mod)
                prefix = ':heavy_multiplication_x:';
            else if (total == size * (!hilo ? count : keep) + mod)
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

            if (!maxed) {
                const MAX_ELEMENTS = 10;
                if (elements.length < MAX_ELEMENTS) {
                    elements.push({
                        'type': 'mrkdwn',
                        'text': `${prefix} ${atoms.join(' ')}`
                    });
                }
                else {
                    maxed = true;
                    elements[MAX_ELEMENTS-1] = {
                        'type': 'mrkdwn',
                        'text': `:warning: Too many rolls to show.`
                    };
                }
            }

            return total;
        };

        let phrases = [];
        let blocks = [];
        for (let i = 0; i < clauses.length; i++) {
            elements = [];
            maxed = false;
            let outcome = postProcessChain(preProcessChain(clauses[i], message).replace(re_code, fun), message);

            if (outcome != clauses[i]) {
                outcome = prettyMarkup(outcome);
                phrases.push(outcome);

                if (blocks.length == 0) {
                    blocks.push({
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': `${who('You', message)} rolled ${outcome}.`
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

                if (elements.length > 0) {
                    blocks.push({
                        'type': 'context',
                        'elements': elements
                    });
                }
            }
        }

        let summary = phrases.join('; ');

        return [summary, blocks];
    }

    // TODO: refactor into parser (see !deal)

    function preProcessChain(content, message) {
        return evaluateArithmeticOps(content);
    }

    function postProcessChain(content, message) {
        return evaluateComparisonOps(
            evaluateArithmeticOps(content)
        );
    }

    function prettyMarkup(content) {
        const re_number = /\b(?<![#_*])[0-9]+(?:\.[0-9]+)?(?![:_*])\b/g,
            re_tag = /<[@#][\w|]+?>/g,
            re_trail= /^[\s.;,]+|[\s.;,]+$/g,
            re_wss = /\s+/g;
        return content.replace(re_number, '*$&*')
            .replace(re_tag, '')
            .replace(re_trail, '')
            .replace(re_wss, ' ');
    }

    function evaluateArithmeticOps(content) {
        const re_math = /([+-]|\b)([0-9]+(?:\.[0-9]+)?)\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\b/;
        const fun = function (_, sign, x, op, y) {
            x = parseFloat(sign+x);
            y = parseFloat(op+y);
            let sum = x+y;
            if (sign && sum >= 0)
                return '+' + sum;
            else
                return sum.toString();
        };

        return regexClosure(content, re_math, fun);
    }

    function evaluateComparisonOps(content) {
        const re_op = /([0-9]+(?:\.[0-9]+)?)\s*(=|==|&gt;|&lt;|&gt;=|=&gt;|&lt;=|=&lt;|!=|&lt;&gt;|&gt;&lt;)\s*([0-9]+(?:\.[0-9]+)?)/g;
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

        return content.replace(re_op, fun);
    }

    function regexClosure(text, re, fun) {
        let old;
        do {
            old = text;
            text = text.replace(re, fun);
        } while (text != old);
        return text;
    };
};
