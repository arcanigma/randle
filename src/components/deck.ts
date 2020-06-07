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
        items: Deck;
        rules?: Rule[];
    };

    type Deck =
        | string
        | { choose: number; from: Deck; }
        | { repeat: number; from: Deck; }
        | Deck[];

    type Rule = {
        show: string | string[];
        to: string | string[];
        as?: string;
    };

    // TODO let all 3 commands work with both syntaxes

    const re_shuffle = /^!?shuffle\s+(.+)/is;
    app.message(re_shuffle, nonthread, anywhere, async ({ message, context, say }) => {
        try {
            const suit = randomInt(0, 3),
                items = parse_deck(context.matches[1]);

            await say({
                username: `${SUIT_NAMES[suit]} Shuffle`,
                icon_emoji: SUIT_EMOJIS[suit],
                text: `${who(message, 'You')} shuffled item${items.length != 1 ? 's' : ''}`,
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
                text: `${who(message, 'You')} drew item${count != 1 ? 's' : ''}`,
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
                }
                catch (err) {
                    throw err.message;
                }
                items = build_deck(setup.items);
            }
            else if (re_yaml_doc.test(context.matches[2])) {
                try {
                    setup = YAML.parse(context.matches[2]);
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
                user != context.botUserId
                && (!setup.moderator || user != message.user)
            ));

            const dealt: {
                [user: string]: string[]
            } = {};
            do {
                users.forEach(user => {
                    if (items.length > 0) {
                        if (dealt[user])
                            dealt[user].push(items.shift()!);
                        else
                            dealt[user] = [items.shift()!];
                    }
                });
            } while (items.length > 0);

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
                all_summary = `${who(message, 'You')} dealt ${all_list} by direct message.`,
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
                if (setup.rules) enlist(setup.rules).filter(rule => rule.show).forEach(rule => {
                    enlist(rule.to).map(wss).filter(to => dealt[user].includes(to)).forEach(to => {
                        enlist(rule.show).map(wss).forEach(show => {
                            Object.keys(dealt).filter(them => them != user && dealt[them].includes(show)).forEach(them => {
                                shown.push(<MrkdwnElement>{
                                    type: 'mrkdwn',
                                    text: trunc(`:eye-in-speech-bubble: Because you were dealt *${to}* you see that <@${them}> was dealt *${!rule.as ? show : wss(rule.as)}*.`, MAX_TEXT_SIZE)
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
        else
            return items.map(item => unnest_deck(item)).flat();
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
        const copy = list;
        for (let i = copy.length - 1; i >= 1; i--) {
            const j = randomInt(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function choose<T>(list: T[], quantity: number): T[] {
        const copy = shuffle(list);
        return copy.slice(list.length - quantity);
    }

    function repeat<T>(list: T[], quantity: number): T[] {
        const build = [];
        for (let i = 1; i <= quantity; i++)
            build.push(list[randomInt(0, list.length - 1)]);
        return build;
    }
};
