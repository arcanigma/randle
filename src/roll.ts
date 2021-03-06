import { App, BotMessageEvent, GenericMessageEvent, MessageEvent, Middleware, SlackEventMiddlewareArgs } from '@slack/bolt';
import { Block, ContextBlock, MrkdwnElement, SectionBlock } from '@slack/web-api';
import { randomInt } from 'crypto';
import { MongoClient } from 'mongodb';
import ordinal from 'ordinal';
import { MAX_CONTEXT_ELEMENTS, MAX_MESSAGE_BLOCKS, MAX_TEXT_SIZE } from './app';
import { trunc, wss } from './library/factory';
import { anywhere } from './library/listeners';
import { blame } from './library/messages';

export const register = ({ app, store }: { app: App; store: Promise<MongoClient> }): void => {
    // TODO refactor into parser

    const re_semis = /\s*;\s*/;
    const clausify: Middleware<SlackEventMiddlewareArgs<'message'>> = async ({ context, next }) => {
        context.clauses = (<string[]> context.matches)[1].trim().split(re_semis);

        await next?.();
    };

    const macrotize: Middleware<SlackEventMiddlewareArgs<'message'>> = async ({ message, context, next }) => {
        const coll = (await store).db().collection('macros');
        const personal = (await coll.findOne(
            { _id: (<GenericMessageEvent> message).user },
            { projection: { _id: 0 } }
        )) as Record<string, string> ?? {},
            community = (await coll.findOne(
                { _id: <string> context.botUserId },
                { projection: { _id: 0 } }
            )) as Record<string, string> ?? {},
            macros = Object.assign({}, community, personal);

        if (Object.keys(macros).length >= 1) {
            const re_macros = new RegExp(`\\b(${Object.keys(macros).join('|')})\\b`, 'gi');
            context.clauses = (<string[]>context.clauses).map((clause: string) =>
                clause.replace(re_macros, m => macros[m.toLowerCase()])
            );
        }

        await next?.();
    };

    const re_roll = /^!?roll\s+(.+)/is;
    app.message(re_roll, anywhere, clausify, macrotize, async ({ message, context, client, say }) => {
        try {
            const clauses = (<string[]>context.clauses).length;
            for (let i = 0; i < clauses; i++)
                (<string[]>context.clauses).push(
                    ...expandRepeats(<string>(<string[]>context.clauses).shift())
                );

            const results = rollDice(context.clauses, message);

            if (results.blocks.length > 0)
                await say({
                    token: <string> context.botToken,
                    channel: message.channel,
                    username: 'Roll',
                    icon_emoji: ':game_die:',
                    text: `<@${(<GenericMessageEvent> message).user}> rolled dice`,
                    blocks: results.blocks,
                    thread_ts: (<BotMessageEvent> message).thread_ts ?? message.ts
                });
        }
        catch (error) {
            await blame({ error: <string|Error> error, message, context, client });
        }
    });

    const re_ellipsis = /^\s*(.+)\s*\.\.\.\s*(\w+(?:\s*,\s*\w+)*)\s*$/,
        re_commas = /\s*,\s*/;
    function expandRepeats (clause: string) {
        const match = re_ellipsis.exec(clause);
        if (match) {
            const phrase = match[1].replace(re_trail, ''),
                over = match[2].split(re_commas),
                reps = parseInt(over[0]);
            const clones = [];
            if (over.length == 1 && reps >= 1)
                for (let i = 1; i <= reps; i++)
                    clones.push(`${phrase} on the ${ordinal(i)} roll`);
            else
                for (const label of over)
                    clones.push(`${phrase} for ${label}`);
            return clones;
        }
        else {
            return [clause];
        }
    }

    function rollDice (clauses: string[], message: MessageEvent) {
        const results: {
            text?: string;
            phrases: string[];
            blocks: Block[];
        } = {
            phrases: [],
            blocks: []
        };

        for (let i = 0; i < clauses.length; i++) {
            clauses[i] = evaluateArithmetic(clauses[i]);

            const elements = [];

            const re_dice_code = /\b([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?\b/ig;
            const outcome = clauses[i].replace(re_dice_code, (expr, count, size, hilo, keep, mod) => {
                count = parseInt(count) || 1;
                size = (size != '%' ? parseInt(size) || 1 : 100);

                const rolls = [];
                for (let i = 1; i <= count; i++)
                    rolls.push(randomInt(size) + 1);

                const strikes: {
                    [key: number]: number;
                } = {};
                if (hilo) {
                    keep = Math.min(parseInt(keep) || 1, count);

                    const sorted = rolls.slice();
                    if ((<string>hilo).toUpperCase() == 'L')
                        sorted.sort((x,y) => x-y);
                    else
                        sorted.sort((x,y) => y-x);
                    for (let i = <number> keep; i < sorted.length; i++) {
                        const key = sorted[i];
                        strikes[key] = (strikes[key] ?? 0) + 1;
                    }
                }

                mod = parseInt(mod) || 0;
                if (mod) rolls.push(mod);

                let atoms = [],
                    total = 0;
                for (const roll of rolls) {
                    const num = parseInt(roll),
                        sign = num >= 0 ? '+' : '-',
                        face = Math.abs(roll);

                    if (atoms.length > 0 || sign == '-')
                        atoms.push(sign);

                    if (!strikes[num]) {
                        total += num;
                        atoms.push(face);
                    }
                    else {
                        strikes[num]--;
                        atoms.push(`~[${face}]~`);
                    }
                }

                let prefix;
                if (total == 1 * (!hilo ? count : keep) + parseInt(mod))
                    prefix = ':heavy_multiplication_x:';
                else if (total == size * (!hilo ? count : keep) + parseInt(mod))
                    prefix = ':heavy_check_mark:';
                else
                    prefix = ':white_square:';

                if (atoms.length > 1)
                    atoms = [ ...atoms, '=', `*${total}*` ];
                else if (atoms.length == 1)
                    atoms[0] = `*${atoms[0]}*`;
                else
                    atoms[0] = '_undefined_';
                atoms = [ `*${expr}:*`, ...atoms ];

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

            if (outcome != clauses[i]) {
                clauses[i] = outcome;
                clauses[i] = evaluateArithmetic(clauses[i]);
                clauses[i] = prettifyMarkdown(clauses[i]);
                results.phrases.push(clauses[i]);

                if (results.blocks.length < MAX_MESSAGE_BLOCKS) {
                    if (results.blocks.length == 0)
                        results.blocks.push(<SectionBlock>{
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: trunc(`<@${(<GenericMessageEvent> message).user}> rolled ${clauses[i]}.`, MAX_TEXT_SIZE)
                            }
                        });
                    else
                        results.blocks.push(<SectionBlock>{
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: trunc(`Then ${clauses[i]}.`, MAX_TEXT_SIZE)
                            }
                        });

                    if (elements.length > 0)
                        results.blocks.push(<ContextBlock>{
                            type: 'context',
                            elements: elements
                        });
                }
            }
        }

        if (results.blocks.length == MAX_MESSAGE_BLOCKS)
            results.blocks[MAX_MESSAGE_BLOCKS-1] = <SectionBlock>{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `:warning: Too many message blocks to show (limit of ${MAX_MESSAGE_BLOCKS}).`
                }
            };

        if (results.phrases.length > 0)
            results.text = trunc(results.phrases.join('; '), MAX_TEXT_SIZE);

        return results;
    }

    const re_number = /\b(?<![:_~*])[1-9][0-9]*(?![:_~*])\b/g,
        re_tag = /<([^>]+)>/g,
        re_trail = /^[\s.;,]+|[\s.;,]+$/g;
    function prettifyMarkdown (clause: string) {
        clause = wss(clause
            .replace(re_number, '*$&*')
            .replace(re_tag, '')
            .replace(re_trail, '')
        );
        return clause;
    }

    const re_math = /([+-]|\b)([0-9]+(?:\.[0-9]+)?)\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\b/;
    function evaluateArithmetic (clause: string) {
        return regexClosure(clause, re_math, (_, sign, x, op, y) => {
            const ix = parseInt(`${sign}${x}`),
                iy = parseInt(`${op}${y}`),
                sum = ix+iy;
            return sign && sum >= 0
                ? `+${sum}`
                : String(sum);
        });
    }

    function regexClosure (clause: string, re: RegExp, fun: (substring: string, ...args: (string | number)[]) => string) {
        let old;
        do {
            old = clause;
            clause = clause.replace(re, fun);
        } while (clause != old);
        return clause;
    }
};
