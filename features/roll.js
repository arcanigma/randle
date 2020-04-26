const randomInt = require('php-random-int'),
      naturalCompare = require('string-natural-compare'),
      toOrdinal = require('ordinal');

const { who, blame, macroize} = require('../plugins/factory.js'),
      { anywhere } = require('../plugins/listen.js');

module.exports = (app) => {

    const listen_roll = async ({ message, context, next }) => {
        let matches;
        if (matches = message.text.match(/^!?roll\s+(.+)$/i)) {
            context.matches = [matches[1]]
            await next();
        }
        else if (matches = message.text.match(/\([^'()][^()]*\)/g)) {
            context.matches = matches.map(m => m.slice(1,-1));
            await next();
        }
    };
    app.message(anywhere, listen_roll, async ({ message, context, say }) => {
        try {
            await macroize(context.matches, message.user);

            let clauses = context.matches.length;
            for (let i = 0; i < clauses; i++)
                context.matches.push(...expandRepeats(context.matches.shift()));

            let { summary, blocks } = rollDice(context.matches, message);
            if (!summary) return;

            let reply = {
                text: `${who(message, 'You')} rolled ${summary}.`,
                blocks: blocks
            };

            const MAX_REPLY_SIZE = 4000;
            if (JSON.stringify(reply).length > MAX_REPLY_SIZE)
                reply = blame('The response was too long to send.');

            reply.token = context.botToken;
            reply.channel = message.channel;
            if (message.thread_ts)
                reply.thread_ts = message.thread_ts;

            await app.client.chat.postMessage(reply);
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    function expandRepeats(clause) {
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

    function rollDice(clauses, message) {
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
                        type: 'mrkdwn',
                        text: `${prefix} ${atoms.join(' ')}`
                    });
                }
                else {
                    maxed = true;
                    elements[MAX_ELEMENTS-1] = {
                        type: 'mrkdwn',
                        text: `:warning: Too many rolls to show.`
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
            let outcome = postProcessChain(preProcessChain(clauses[i]).replace(re_code, fun));

            if (outcome != clauses[i]) {
                outcome = prettifyMarkdown(outcome);
                phrases.push(outcome);

                if (blocks.length == 0) {
                    blocks.push({
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${who(message, 'You')} rolled ${outcome}.`
                          }
                    });
                }
                else {
                    // blocks.push({
                    //     type: 'divider'
                    // });
                    blocks.push({
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `Then ${outcome}.`
                          }
                    });
                }

                if (elements.length > 0) {
                    blocks.push({
                        type: 'context',
                        elements: elements
                    });
                }
            }
        }

        let summary = phrases.join('; ');

        return {
            summary: summary,
            blocks: blocks
        };
    }

    // TODO: refactor into parser (see !deal)

    function preProcessChain(content) {
        return evaluateArithmetic(content);
    }

    function postProcessChain(content) {
        return evaluateComparisons(evaluateArithmetic(content));
    }

    function prettifyMarkdown(content) {
        const re_number = /\b(?<![#_*])[0-9]+(?:\.[0-9]+)?(?![:_*])\b/g,
            re_tag = /<[@#][\w|]+?>/g,
            re_trail= /^[\s.;,]+|[\s.;,]+$/g,
            re_wss = /\s+/g;
        return content.replace(re_number, '*$&*')
            .replace(re_tag, '')
            .replace(re_trail, '')
            .replace(re_wss, ' ');
    }

    function evaluateArithmetic(content) {
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

    function evaluateComparisons(content) {
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
