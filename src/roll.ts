import { App, Context, MessageEvent, Middleware, SlackEventMiddlewareArgs } from '@slack/bolt';
import { Block, ContextBlock, MrkdwnElement, SectionBlock } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import ordinal from 'ordinal';
import randomInt from 'php-random-int';
import { MAX_CONTEXT_ELEMENTS, MAX_MESSAGE_BLOCKS, MAX_TEXT_SIZE } from './app.js';
import { trunc, who, wss } from './library/factory';
import { anywhere } from './library/listeners';
import { blame } from './library/messages';

export const events = (app: App, store: Promise<MongoClient>): void => {
    type Clause = {
        text: string;
        where: string;
    };

    // TODO refactor into parser
    // TODO support JSON Script embeds, even in macros

    const re_roll = /^!?roll\s+(.+)/i,
          re_parens = /(?:\([^'()][^()]*\)|\[[^'[\]][^[\]]*\])/g;
    const listen_roll: Middleware<SlackEventMiddlewareArgs<'message'>> = async ({ message, context, next }) => {
        if (message.text) {
            let matches;
            if ((matches = wss(message.text).match(re_roll))) {
                context.clauses = [{
                    text: matches[1],
                    where: 'inline'
                }];
                await next?.();
            }
            else if ((matches = wss(message.text).match(re_parens))) {
                context.clauses = matches.map(m => ({
                    text: m.slice(1,-1),
                    where: m.slice(0, 1) == '[' && !message.thread_ts ? 'thread' : 'inline'
                }));
                await next?.();
            }
        }
    };
    app.message(listen_roll, anywhere, async ({ message, context, client, say }) => {
        try {
            context.clauses = await macroize(store, context, message.user);

            const clauses = context.clauses.length;
            for (let i = 0; i < clauses; i++)
                context.clauses.push(...expandRepeats(context.clauses.shift()));

            const results = rollDice(context.clauses, message);

            for (const where in results) {
                if (results[where].blocks.length > 0)
                    await say({
                        token: context.botToken,
                        channel: message.channel,
                        username: 'Roll',
                        icon_emoji: ':game_die:',
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
            await blame(err, message, context, client);
        }
    });

    async function macroize(store: Promise<MongoClient>, context: Context, user: string) {
        const coll = (await store).db().collection('macros');
        const macros = (await coll.findOne(
                { _id: user },
                { projection: { _id: 0} }
            )) ?? {};
        const community = (await coll.findOne(
            { _id: context.botUserId },
            { projection: { _id: 0} }
        )) ?? {};
        Object.keys(community).forEach(name => {
            if (!macros[name])
                macros[name] = community[name];
        });

        const re_macros = new RegExp(`\\b(${Object.keys(macros).join('|')})\\b`, 'gi');
        return context.clauses.map((clause: Clause) => ({
            text: clause.text.replace(re_macros, m => macros[m.toLowerCase()]),
            where: clause.where
        }));
    }

    const re_ellipsis = /^\s*(.+)\s*\.\.\.\s*(\w+(?:\s*,\s*\w+)*)\s*$/,
          re_commas = /\s*,\s*/;
    function expandRepeats(clause: Clause) {
        const match = clause.text.match(re_ellipsis);
        if (match) {
            const phrase = match[1].replace(re_trail, ''),
                over = match[2].split(re_commas),
                reps = parseInt(over[0]);
            const clones = [];
            if (over.length == 1 && reps >= 1)
                for (let i = 1; i <= reps; i++)
                    clones.push({
                        text: `${phrase} on the ${ordinal(i)} roll`,
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

    function rollDice(clauses: Clause[], message: MessageEvent) {
        const results: {
            [where: string]: {
                text?: string,
                phrases: string[],
                blocks: Block[];
            }
        } = {
            inline: {
                phrases: [],
                blocks: []
            },
            thread: {
                phrases: [],
                blocks: []
            }
        };

        for (let i = 0; i < clauses.length; i++) {
            clauses[i] = evaluateArithmetic(clauses[i]);

            const elements = [];

            const re_dice_code = /\b([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?\b/ig;
            const outcome = clauses[i].text.replace(re_dice_code, (expr, count, size, hilo, keep, mod) => {
                count = parseInt(count) || 1;
                size = (size != '%' ? parseInt(size) || 1 : 100);

                const rolls = [];
                for (let i = 1; i <= count; i++)
                    rolls.push(randomInt(1, size));

                const strikes: {
                    [key: number]: number
                } = {};
                if (hilo) {
                    keep = Math.min(parseInt(keep) || 1, count);

                    const sorted = rolls.slice();
                    if (hilo.toUpperCase() == 'L')
                        sorted.sort((x,y) => x-y);
                    else
                        sorted.sort((x,y) => y-x);
                    for (let i = keep; i < sorted.length; i++) {
                        const key = sorted[i];
                        strikes[key] = (strikes[key] ?? 0) + 1;
                    }
                }

                mod = parseFloat(mod) || 0;
                if (mod) rolls.push(mod);

                let atoms = [],
                    total = 0;
                for (let i = 0; i < rolls.length; i++) {
                    const roll = rolls[i],
                        key = roll.toString(),
                        sign = roll >= 0 ? '+' : '-',
                        face = `${Math.abs(roll)}`;

                    if (atoms.length > 0 || sign == '-')
                        atoms.push(sign);

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
                if (total == 1 * (!hilo ? count : keep) + mod)
                    prefix = ':heavy_multiplication_x:';
                else if (total == size * (!hilo ? count : keep) + mod)
                    prefix = ':heavy_check_mark:';
                else
                    prefix = ':white_square:';

                if (atoms.length > 1)
                    atoms = [...atoms, '=', `*${total}*`];
                else if (atoms.length == 1)
                    atoms[0] = `*${atoms[0]}*`;
                else
                    atoms[0] = '_undefined_';
                atoms = [`*${expr}:*`, ...atoms];

                if (elements.length < MAX_CONTEXT_ELEMENTS)
                    elements.push(<MrkdwnElement>{
                        type: 'mrkdwn',
                        text: trunc(`${prefix} ${atoms.join(' ')}`, MAX_TEXT_SIZE)
                    });

                return `${total}`;
            });

            if (elements.length == MAX_CONTEXT_ELEMENTS)
                elements[MAX_CONTEXT_ELEMENTS-1] = <MrkdwnElement>{
                    type: 'mrkdwn',
                    text: `:warning: Too many context elements to show (limit of ${MAX_CONTEXT_ELEMENTS}).`
                };

            if (outcome != clauses[i].text) {
                clauses[i].text = outcome;
                clauses[i] = evaluateArithmetic(clauses[i]);
                clauses[i] = prettifyMarkdown(clauses[i]);
                results[clauses[i].where].phrases.push(clauses[i].text);

                if (results[clauses[i].where].blocks.length < MAX_MESSAGE_BLOCKS) {
                    if (results[clauses[i].where].blocks.length == 0)
                    results[clauses[i].where].blocks.push(<SectionBlock>{
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: trunc(`${clauses[i].where == 'inline' ? who(message, 'You') : 'You'} rolled ${clauses[i].text}.`, MAX_TEXT_SIZE)
                            }
                        });
                    else
                    results[clauses[i].where].blocks.push(<SectionBlock>{
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: trunc(`Then ${clauses[i].text}.`, MAX_TEXT_SIZE)
                            }
                        });

                    if (elements.length > 0)
                        results[clauses[i].where].blocks.push(<ContextBlock>{
                            type: 'context',
                            elements: elements
                        });
                }
            }
        }

        for (const where in results) {
            if (results[where].blocks.length == MAX_MESSAGE_BLOCKS)
                results[where].blocks[MAX_MESSAGE_BLOCKS-1] = <SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `:warning: Too many message blocks to show (limit of ${MAX_MESSAGE_BLOCKS}).`
                    }
                };

            if (results[where].phrases.length > 0)
                results[where].text = trunc(results[where].phrases.join('; '), MAX_TEXT_SIZE);
        }
        return results;
    }

    const re_number = /\b(?<![:_~*])[1-9][0-9]*(?![:_~*])\b/g,
        re_tag = /<([^>]+)>/g,
        re_trail = /^[\s.;,]+|[\s.;,]+$/g;
    function prettifyMarkdown(clause: Clause) {
        clause.text = wss(clause.text
            .replace(re_number, '*$&*')
            .replace(re_tag, '')
            .replace(re_trail, '')
        );
        return clause;
    }

    const re_math = /([+-]|\b)([0-9]+(?:\.[0-9]+)?)\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\b/;
    function evaluateArithmetic(clause: Clause) {
        return regexClosure(clause, re_math, (_, sign, x, op, y) => {
            x = parseFloat(`${sign}${x}`);
            y = parseFloat(`${op}${y}`);
            const sum = x+y;
            return sign && sum >= 0
                ? '+' + sum
                : sum.toString();
        });
    }

    function regexClosure(clause: Clause, re: RegExp, fun: (substring: string, ...args: (string | number)[]) => string) {
        let old;
        do {
            old = clause.text;
            clause.text = clause.text.replace(re, fun);
        } while (clause.text != old);
        return clause;
    }
};
