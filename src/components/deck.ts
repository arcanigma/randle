import { App } from '@slack/bolt';
import { Block, SectionBlock, ContextBlock, MrkdwnElement, WebAPICallResult } from '@slack/web-api';
import JSON5 from 'json5';
import YAML from 'yaml';

import randomInt from 'php-random-int';

import { MAX_TEXT_SIZE, MAX_CONTEXT_ELEMENTS } from '../app.js';
import { who, commas, names, trunc, wss, blame } from '../library/factory';
import { nonthread, anywhere, community } from '../library/listeners';
import { tokenize, expect, expectEnd, accept } from '../library/parser';

// TODO add a script builder modal
export default (app: App): void => {
    const SUIT_NAMES = ['Spade', 'Heart', 'Club', 'Diamond' ];
    const SUIT_EMOJIS = [ ':spades:', ':hearts:', ':clubs:', ':diamonds:' ];

    type DealScript = {
        event?: string;
        moderator?: boolean;
        limit?: number;
        items: Deck;
        rules?: Rule[];
    };

    type Deck =
        | string
        | { choose: number; from: Deck; }
        | { repeat: number; from: Deck; }
        | { cross: Deck; with: Deck; using?: string; }
        | { zip: Deck; with: Deck; using?: string; }
        | Deck[];

    type Rule = {
        show: Matcher | Matcher[];
        to: Matcher | Matcher[];
        as?: string;
    };

    type Matcher =
        | string
        | { startsWith: string }
        | { endsWith: string }
        | { includes: string };

    // TODO let all 3 commands work with both syntaxes

    const re_shuffle = /^!?shuffle\s+(.+)/is;
    app.message(re_shuffle, nonthread, anywhere, async ({ message, context, say }) => {
        try {
            const suit = randomInt(0, 3),
                items = parse_deck(context.matches[1]);

            await say({
                username: `${SUIT_NAMES[suit]} Shuffle`,
                icon_emoji: SUIT_EMOJIS[suit],
                text: `${who(message, 'You')} shuffled ${items.length != 1 ? 'items' : 'an item'}`,
                blocks: [<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(`${who(message, 'You')} shuffled ${commas(items.map(item => `*${item}*`))}.`, MAX_TEXT_SIZE)
                    }
                }]
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_draw = /^!?draw\s+(?:([1-9][0-9]*)\s+from\s+)?(.+)/is;
    app.message(re_draw, nonthread, anywhere, async ({ message, context, say }) => {
        try {
            const suit = randomInt(0, 3),
                count = context.matches[1] ?? 1,
                items = parse_deck(`(${context.matches[2]}):${count}`);

            await say({
                username: `${SUIT_NAMES[suit]} Draw`,
                icon_emoji: SUIT_EMOJIS[suit],
                text: `${who(message, 'You')} drew ${count != 1 ? 'items' : 'an item'}`,
                blocks: [<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(`${who(message, 'You')} drew ${commas(items.map(item => `*${item}*`))}.`, MAX_TEXT_SIZE)
                    }
                }]
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_deal = /^([!?])?deal\s+(.+)/is,
        re_json_doc = /^\{.+\}$/s,
        re_yaml_doc = /^---.+$/s;
    app.message(re_deal, nonthread, community, async ({ message, context, say, client }) => {
        try {
            const suit = randomInt(0, 3),
                dry_run = context.matches[1] == '?';

            let setup: DealScript,
                items: string[];
            if (re_json_doc.test(context.matches[2])) {
                try {
                    setup = JSON5.parse(context.matches[2]);
                    // TODO validate against DealScript
                }
                catch (err) {
                    throw err.message;
                }
                items = build_deck(setup.items);
            }
            else if (re_yaml_doc.test(context.matches[2])) {
                try {
                    setup = YAML.parse(context.matches[2]);
                    // TODO validate against DealScript
                }
                catch (err) {
                    throw err.message;
                }
                items = build_deck(setup.items);
            }
            else {
                setup = {
                    items: context.matches[2]
                };
                items = parse_deck(<string>setup.items);
            }

            const users = shuffle((await client.conversations.members({
                token: context.botToken,
                channel: message.channel
            }) as WebAPICallResult & {
                members: string[]
            }).members.filter(user =>
                user != context.botUserId // TODO filter all bots
                && (!setup.moderator || user != message.user)
            ));

            const dealt: {
                [user: string]: string[]
            } = {};
            const rounds = setup.limit === undefined
                ? Math.ceil(items.length / users.length)
                : Math.min(setup.limit, Math.floor(items.length / users.length));
            for (let round = 1; round <= rounds; round++)
                users.forEach(user => {
                    if (items.length > 0) {
                        if (dealt[user])
                            dealt[user].push(items.shift()!);
                        else
                            dealt[user] = [items.shift()!];
                    }
                });

            // TODO figure out high/low groups with math
            const counts: {
                [count: number]: string[]
            } = {};
            users.forEach(user => {
                const count = dealt[user].length;
                if (!counts[count])
                    counts[count] = [user];
                else
                    counts[count].push(user);
            });

            const all_list = commas(Object.keys(counts).map(Number).sort().reverse().map(count => {
                    return `${count > 0 ? `*${count}* each` : '*none*'} to ${names(counts[count])}`;
                }), '; '),
                all_notification = `${who(message, 'You')} dealt items`,
                all_summary = `${who(message, 'You')} dealt ${all_list} by direct message${items.length == 0 ? '' : ` with *${items.length}* leftover${setup.moderator ? ` for <@${message.user}>` : ''}`}.`,
                all_blocks: Block[] = [<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(all_summary, MAX_TEXT_SIZE)
                    }
                }];

            let ts;
            if (!dry_run) {
                ts = (await client.chat.postMessage({
                    token: context.botToken,
                    channel: message.channel,
                    username: `${SUIT_NAMES[suit]} Deal`,
                    icon_emoji: SUIT_EMOJIS[suit],
                    text: all_notification,
                    blocks: all_blocks
                }) as WebAPICallResult & {
                    ts: string
                }).ts;
            }
            else {
                await client.chat.postEphemeral({
                    token: context.botToken,
                    channel: message.channel,
                    user: message.user,
                    text: 'Your `deal` script is valid.'
                });

                return;
            }

            const permalink = ts ? (await client.chat.getPermalink({
                channel: message.channel,
                message_ts: ts
            })).permalink : undefined;

            Object.keys(dealt).forEach(async (user) => {
                const per_list = commas(dealt[user].map(item => `*${item}*`)),
                    per_venue = setup.event ? `for the *${setup.event}* event` : `from the <#${message.channel}> channel`,
                    per_notification = `${message.user != user ? `<@${message.user}>` : 'You'} dealt ${message.user != user ? 'you' : 'yourself'} ${dealt[user].length != 1 ? 'items' : 'an item'}`,
                    per_summary = `${message.user != user ? `<@${message.user}>` : 'You'} dealt ${message.user != user ? 'you' : 'yourself'} ${per_list} ${per_venue} <!date^${parseInt(message.ts)}^{date_short_pretty} at {time}^${permalink}|there>.`,
                    per_blocks: Block[] = [];

                per_blocks.push(<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(per_summary, MAX_TEXT_SIZE)
                    }
                });

                let shown: MrkdwnElement[] = [];
                if (setup.rules)
                    enlist(setup.rules).filter(rule => rule.show).forEach(rule => {
                        enlist(rule.to).filter(to => dealt[user].some(it => matches(it, to))).forEach(to => {
                            enlist(rule.show).forEach(show => {
                                Object.keys(dealt).filter(them => them != user && dealt[them].some(it => matches(it, show))).forEach(them => {
                                    shown.push(<MrkdwnElement>{
                                        type: 'mrkdwn',
                                        text: trunc(`:eye-in-speech-bubble: Because you were dealt *${unmatcherize(to)}* you see that <@${them}> was dealt *${!rule.as ? unmatcherize(show) : wss(rule.as)}*.`, MAX_TEXT_SIZE)
                                    });
                                });
                            });
                        });
                    });
                if (shown.length > 0) {
                    shown = shuffle(shown);

                    if (shown.length > MAX_CONTEXT_ELEMENTS)
                        shown = [
                            ...shown.slice(0, MAX_CONTEXT_ELEMENTS - 1),
                            <MrkdwnElement>{
                                type: 'mrkdwn',
                                text: trunc(`:warning: Too many context elements to show (limit of ${MAX_CONTEXT_ELEMENTS}).`, MAX_TEXT_SIZE)
                            }
                        ];

                    per_blocks.push(<ContextBlock>{
                        type: 'context',
                        elements: shown
                    });
                }

                const dm = (await client.conversations.open({
                    token: context.botToken,
                    users: !setup.moderator ? user : `${user},${message.user}`
                }) as WebAPICallResult & {
                    channel: {
                        id: string
                    }
                }).channel.id;

                await client.chat.postMessage({
                    token: context.botToken,
                    channel: dm,
                    username: `${SUIT_NAMES[suit]} Deal`,
                    icon_emoji: SUIT_EMOJIS[suit],
                    text: per_notification,
                    blocks: per_blocks
                });
            });

            if (setup.moderator && items.length > 0) {
                const dm = (await client.conversations.open({
                    token: context.botToken,
                    users: message.user
                }) as WebAPICallResult & {
                    channel: {
                        id: string
                    }
                }).channel.id;

                await client.chat.postMessage({
                    token: context.botToken,
                    channel: dm,
                    username: `${SUIT_NAMES[suit]} Deal`,
                    icon_emoji: SUIT_EMOJIS[suit],
                    text: `${who(message, 'You')} dealt with leftover${items.length != 1 ? 's' : ''}`,
                    blocks: [<SectionBlock>{
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: trunc(`${who(message, 'You')} dealt to ${names(Object.keys(dealt))} with ${commas(items.map(item => `*${item}*`))} leftover.`, MAX_TEXT_SIZE)
                        }
                    }]
                });
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    function build_deck(items: Deck): string[] {
        return shuffle(unnest_deck(items));
    }

    function unnest_deck(items: Deck): string[] {
        if (typeof items === 'string')
            return [wss(items)];
        else if ('choose' in items)
            return choose(unnest_deck(items.from), items.choose);
        else if ('repeat' in items)
            return repeat(unnest_deck(items.from), items.repeat);
        else if ('cross' in items)
            return cross(unnest_deck(items.cross), unnest_deck(items.with), items.using);
        else if ('zip' in items)
            return zip(unnest_deck(items.zip), unnest_deck(items.with), items.using);
        else //if (Array.isArray(items))
            return items.map(item => unnest_deck(item)).flat();
        // else
        //     throw unexpected('item', items);
    }

    const re_terminals = /([(,):*])/;
    function parse_deck(text: string): string[] {
        const tokens = tokenize(text, re_terminals),
            deck = parse_list(tokens);
        expectEnd(tokens);
        return shuffle(deck);
    }

    function parse_list(tokens: string[]): string[] {
        const list = [];
        do {
            list.push(...parse_element(tokens));
        } while (accept(tokens, ','));
        return list;
    }

    const re_nonterminals = /[^(,):*]+/;
    function parse_element(tokens: string[]): string[] {
        let list;
        if (accept(tokens, '(')) {
            const items = parse_list(tokens);
            list = items;
            expect(tokens, ')');
        }
        else {
            const item = expect(tokens, re_nonterminals);
            list = [wss(item)];
        }
        return parse_quantifier(tokens, list);
    }

    const re_integer = /[1-9][0-9]*/;
    function parse_quantifier(tokens: string[], list: string[]): string[] {
        if (accept(tokens, ':')) {
            const quantity = parseInt(expect(tokens, re_integer));
            list = choose(list, quantity);
            return parse_quantifier(tokens, list);
        }
        else if (accept(tokens, '*')) {
            const quantity = parseInt(expect(tokens, re_integer));
            list = repeat(list, quantity);
            return parse_quantifier(tokens, list);
        }
        else return list;
    }

    function enlist<T>(element: T | T[]): T[] {
        if (element === undefined)
            return [];
        else if (Array.isArray(element))
            return element.flat() as T[];
        else
            return [element];
    }

    function shuffle<T>(list: T[]): T[] {
        const copy = [...list];
        for (let i = copy.length - 1; i >= 1; i--) {
            const j = randomInt(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function choose<T>(list: T[], quantity: number): T[] {
        return shuffle(list).slice(list.length - quantity);
    }

    function repeat<T>(list: T[], quantity: number): T[] {
        const build = [];
        for (let i = 1; i <= quantity; i++)
            build.push(list[randomInt(0, list.length - 1)]);
        return build;
    }

    function cross<T>(list1: T[], list2: T[], join?: T): string[] {
        const build = [];
        for (let i = 0; i < list1.length; i++)
            for (let j = 0; j < list2.length; j++)
                build.push(`${list1[i]}${join ? ` ${join} ` : ' '}${list2[j]}`);
        return shuffle(build);
    }

    function zip<T>(list1: T[], list2: T[], join?: T): string[] {
        const build = [],
            copy1 = shuffle(list1),
            copy2 = shuffle(list2);
        for (let i = 0; i < Math.min(list1.length, list2.length); i++)
            build.push(`${copy1[i]}${join ? ` ${join} ` : ' '}${copy2[i]}`);
        return build;
    }

    function matches(it: string, matcher: string | Matcher): boolean {
        if (typeof matcher === 'string')
            return it == wss(matcher);
        else if ('startsWith' in matcher)
            return it.startsWith(wss(matcher.startsWith));
        else if ('endsWith' in matcher)
            return it.endsWith(wss(matcher.endsWith));
        else //if ('includes' in matcher)
            return it.includes(wss(matcher.includes));
        // else
        //     throw unexpected('matcher', matcher);
    }

    function unmatcherize(matcher: string | Matcher): string {
        if (typeof matcher === 'string')
            return wss(matcher);
        else if ('startsWith' in matcher)
            return `_starts with_ ${wss(matcher.startsWith)}`;
        else if ('endsWith' in matcher)
            return `_ends with_ ${wss(matcher.endsWith)}`;
        else //if ('includes' in matcher)
            return `_includes_ ${wss(matcher.includes)}`;
        // else
        //     throw unexpected('matcher', matcher);
    }

    // function unexpected(description: string, object: Record<string, unknown>): string {
    //     const keys = Object.keys(object);
    //     return `Unexpected ${description} with ${commas(keys.map(key => `\`${key}\``))} propert${keys.length != 1 ? 'ies' : 'y'}.`;
    // }
};
