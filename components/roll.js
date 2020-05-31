const randomInt = require('php-random-int'),
      toOrdinal = require('ordinal');

const { who, trunc, wss, blame } = require('../library/factory.js'),
      { anywhere } = require('../library/listeners.js');

module.exports = ({ app, store }) => {
    const MAX_TEXT = 300,
          MAX_MESSAGE_BLOCKS = 50,
          MAX_CONTEXT_ELEMENTS = 10;

    const re_roll = /^!?roll\s+(.+)/i,
          re_parens = /(?:\([^'()][^()]*\)|\[[^'[\]][^[\]]*\])/g;
    const listen_roll = async ({ message, context, next }) => {
        if (message.text) {
            let matches;
            if ((matches = wss(message.text).match(re_roll))) {
                context.clauses = [{
                    text: matches[1],
                    where: 'inline'
                }];
                await next();
            }
            else if ((matches = wss(message.text).match(re_parens))) {
                context.clauses = matches.map(m => ({
                    text: m.slice(1,-1),
                    where: m.slice(0, 1) == '[' && !message.thread_ts ? 'thread' : 'inline'
                }));
                await next();
            }
        }
    };
    app.message(anywhere, listen_roll, async ({ message, context, say }) => {
        try {
            context.clauses = await macroize(store, context, message.user);

            let clauses = context.clauses.length;
            for (let i = 0; i < clauses; i++)
                context.clauses.push(...expandRepeats(context.clauses.shift()));

            let results = rollDice(context.clauses, message);

            for (let where in results) {
                await say({
                    token: context.botToken,
                    channel: message.channel,
                    text: `${who(message, 'You')} rolled dice`,
                    blocks: results[where].blocks,
                    ...(message.thread_ts ? {
                        thread_ts: message.thread_ts
                    } : where == 'thread' ? {
                        thread_ts: message.ts
                    } : {})
                });
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    async function macroize(store, context, uid) {
        let coll = (await store).db().collection('macros');
        let macros = (await coll.findOne(
                { _id: uid },
                { projection: { _id: 0} }
            )) || {},
            globals = (await coll.findOne( // TODO super user creates
                { _id: context.botUserId },
                { projection: { _id: 0} }
            )) || {};
        Object.keys(globals).forEach(name => {
            if (!macros[name])
                macros[name] = globals[name];
        });

        let re_macros = new RegExp(`\\b(${Object.keys(macros).join('|')})\\b`, 'gi');
        return context.clauses.map(clause => ({
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

        let elements;
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

            if (elements.length < MAX_CONTEXT_ELEMENTS)
                elements.push({
                    type: 'mrkdwn',
                    text: trunc(`${prefix} ${atoms.join(' ')}`, MAX_TEXT)
                });

            return total;
        };

        for (let i = 0; i < clauses.length; i++) {
            clauses[i] = evaluateArithmetic(clauses[i]);

            elements = [];
            let outcome = clauses[i].text.replace(re_dice_code, re_dice_fun);
            if (elements.length == MAX_CONTEXT_ELEMENTS)
                elements[MAX_CONTEXT_ELEMENTS-1] = {
                    type: 'mrkdwn',
                    text: `:warning: Too many context elements to show (limit of ${MAX_CONTEXT_ELEMENTS}).`
                };

            if (outcome != clauses[i].text) {
                clauses[i].text = outcome;
                clauses[i] = evaluateArithmetic(clauses[i]);
                clauses[i] = evaluateComparisons(clauses[i]);
                clauses[i] = prettifyMarkdown(clauses[i]);
                phrases[clauses[i].where].push(clauses[i].text);

                if (blocks[clauses[i].where].length < MAX_MESSAGE_BLOCKS) {
                    if (blocks[clauses[i].where].length == 0)
                        blocks[clauses[i].where].push({
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: trunc(`${clauses[i].where == 'inline' ? who(message, 'You') : 'You'} rolled ${clauses[i].text}.`, MAX_TEXT)
                            }
                        });
                    else
                        blocks[clauses[i].where].push({
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: trunc(`Then ${clauses[i].text}.`, MAX_TEXT)
                            }
                        });

                    if (elements.length > 0)
                        blocks[clauses[i].where].push({
                            type: 'context',
                            elements: elements
                        });
                }
            }
        }

        let results = {};
        for (let where in phrases) {
            if (blocks[where].length == MAX_MESSAGE_BLOCKS)
                blocks[where][MAX_MESSAGE_BLOCKS-1] = {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `:warning: Too many message blocks to show (limit of ${MAX_MESSAGE_BLOCKS}).`
                    }
                };

            if (phrases[where].length > 0)
                results[where] = {
                      text: trunc(phrases[where].join('; '), MAX_TEXT),
                      blocks: blocks[where]
                };
        }
        return results;
    }

    // TODO refactor into true parser

    const re_number = /\b(?<![#_*])[0-9]+(?:\.[0-9]+)?(?![:_*])\b/g,
        re_ignore = /<(.*?)>/g,
        re_trail = /^[\s.;,]+|[\s.;,]+$/g;
    function prettifyMarkdown(clause) {
        clause.text = wss(clause.text.replace(re_number, '*$&*')
            .replace(re_ignore, '')
            .replace(re_trail, ''));
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
