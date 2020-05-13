const randomInt = require('php-random-int'),
      toOrdinal = require('ordinal');

const { who, blame } = require('../plugins/factory.js'),
      { anywhere } = require('../plugins/listen.js');

module.exports = (app, store) => {

    const MAX_REPLY_SIZE = 4000,
          MAX_ELEMENTS = 10;

    const re_roll = /^!?roll\s+(.+)/i,
          re_parens = /(?:\([^'()][^()]*\)|\[[^'[\]][^[\]]*\])/g;
    const listen_roll = async ({ message, context, next }) => {
        if (message.text) {
            let matches;
            if ((matches = message.text.match(re_roll))) {
                context.clauses = [{
                    text: matches[1],
                    where: 'inline'
                }];
                await next();
            }
            else if ((matches = message.text.match(re_parens))) {
                context.clauses = matches.map(m => ({
                    text: m.slice(1,-1),
                    where: m.slice(0, 1) == '[' && !message.thread_ts ? 'thread' : 'inline'
                }));
                await next();
            }
        }
    };
    app.message(anywhere, listen_roll, async ({ message, context, say, client }) => {
        try {
            context.clauses = await macroize(store, context.clauses, message.user);

            let clauses = context.clauses.length;
            for (let i = 0; i < clauses; i++)
                context.clauses.push(...expandRepeats(context.clauses.shift()));

            let results = rollDice(context.clauses, message);

            for (let where in results) {
                let reply = {
                    text: `${who(message, 'You')} rolled ${results[where].text}.`,
                    blocks: results[where].blocks
                };

                if (JSON.stringify(reply).length > MAX_REPLY_SIZE)
                    throw 'The response was too long to send.';

                reply.token = context.botToken;
                reply.channel = message.channel;
                if (message.thread_ts)
                    reply.thread_ts = message.thread_ts;
                else if (where == 'thread')
                    reply.thread_ts = message.ts;

                await client.chat.postMessage(reply);
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    // TODO super user creates, bot owns
    const DICTIONARY = {
        adv: '2d20H',
        dis: '2d20L'
    }

    async function macroize(store, clauses, uid) {
        let coll = (await store).db().collection('macros');
        let macros = (await coll.findOne(
            { _id: uid },
            { projection: { _id: 0} }
        ));

        macros = macros ? Object.assign(DICTIONARY, macros) : DICTIONARY;
        let re_macros = new RegExp(`\\b(${Object.keys(macros).join('|')})\\b`, 'gi');

        return clauses.map(clause => ({
            text: clause.text.replace(re_macros, m => macros[m.toLowerCase()]),
            where: clause.where
        }));
    }

    const re_ellipsis = /^\s*(.+)\s*\.\.\.\s*(\w+(?:\s*,\s*\w+)*)\s*$/,
          re_commas = /\s*,\s*/;
    function expandRepeats(clause) {
        let match = clause.text.match(re_ellipsis);
        if (match) {
            let phrase = match[1].replace(re_trail, ''),
                over = match[2].split(re_commas),
                reps = parseInt(over[0]);
            let clones = [];
            if (over.length == 1 && reps >= 1)
                for (let i = 1; i <= reps; i++)
                    clones.push({
                        text: `${phrase} on the ${toOrdinal(i)} roll`,
                        where: clause.where
                    });
            else
                for (let i = 0; i < over.length; i++)
                    clones.push({
                        text: `${phrase} for ${over[i]}`,
                        where: clause.where
                    });
            return clones;
        }
        else {
            return [clause];
        }
    }

    function rollDice(clauses, message) {
        let phrases = {
                inline: [],
                thread: []
            },
            blocks = {
                inline: [],
                thread: []
            };

        let elements, maxed;
        const re_dice_code = /(~|\b)([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?(?:(\*|\/|\||\\)([0-9]+(?:\.[0-9]+)?))?\b/ig;
        const re_dice_fun = function(expr, avg, count, size, hilo, keep, mod, muldev, fact) {
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

                if (muldev == '*') {
                    atoms = [...atoms, '×', fact];
                    total *= fact;
                }
                else {
                    atoms = [...atoms, '÷', fact];
                    let quotient = total / fact,
                        fractional = !Number.isInteger(quotient);
                    if (muldev == '/') {
                        if (fractional) atoms.push('rounded down');
                        total = Math.floor(quotient);
                    }
                    else if (muldev == '|') {
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
                        text: `:warning: Too many to show.`
                    };
                }
            }

            return total;
        };

        for (let i = 0; i < clauses.length; i++) {
            clauses[i] = evaluateArithmetic(clauses[i]);

            elements = [], maxed = false;
            let outcome = clauses[i].text.replace(re_dice_code, re_dice_fun);

            if (outcome != clauses[i].text) {
                clauses[i].text = outcome;
                clauses[i] = evaluateArithmetic(clauses[i]);
                clauses[i] = evaluateComparisons(clauses[i]);
                clauses[i] = prettifyMarkdown(clauses[i]);
                phrases[clauses[i].where].push(clauses[i].text);

                if (blocks[clauses[i].where].length == 0)
                    blocks[clauses[i].where].push({
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${clauses[i].where == 'inline' ? who(message, 'You') : 'You'} rolled ${clauses[i].text}.`
                          }
                    });
                else
                    blocks[clauses[i].where].push({
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `Then ${clauses[i].text}.`
                          }
                    });

                if (elements.length > 0)
                    blocks[clauses[i].where].push({
                        type: 'context',
                        elements: elements
                    });
            }
        }

        let results = {};
        for (let where in phrases) {
            if (phrases[where].length > 0)
                results[where] = {
                      text: phrases[where].join('; '),
                      blocks: blocks[where]
                }
        }
        return results;
    }

    // TODO refactor into true parser

    const re_number = /\b(?<![#_*])[0-9]+(?:\.[0-9]+)?(?![:_*])\b/g,
        re_ignore = /<(.*?)>/g,
        re_trail = /^[\s.;,]+|[\s.;,]+$/g,
        re_wss = /\s+/g;
    function prettifyMarkdown(clause) {
        clause.text = clause.text.replace(re_number, '*$&*')
            .replace(re_ignore, '')
            .replace(re_trail, '')
            .replace(re_wss, ' ');
        return clause;
    }

    const re_math = /([+-]|\b)([0-9]+(?:\.[0-9]+)?)\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\b/;
    function evaluateArithmetic(clause) {
        const fun = function (_, sign, x, op, y) {
            x = parseFloat(sign+x);
            y = parseFloat(op+y);
            let sum = x+y;
            if (sign && sum >= 0)
                return '+' + sum;
            else
                return sum.toString();
        };

        return regexClosure(clause, re_math, fun);
    }

    const re_comp = /([0-9]+(?:\.[0-9]+)?)\s*(=|==|&gt;|&lt;|&gt;=|=&gt;|&lt;=|=&lt;|!=|&lt;&gt;|&gt;&lt;)\s*([0-9]+(?:\.[0-9]+)?)/g;
    function evaluateComparisons(clause) {
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

        clause.text = clause.text.replace(re_comp, fun);
        return clause;
    }

    function regexClosure(clause, re, fun) {
        let old;
        do {
            old = clause.text;
            clause.text = clause.text.replace(re, fun);
        } while (clause.text != old);
        return clause;
    }

};
