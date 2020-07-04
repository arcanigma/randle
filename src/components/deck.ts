import { App } from '@slack/bolt';
import { Block, SectionBlock, ContextBlock, MrkdwnElement, WebAPICallResult } from '@slack/web-api';

import randomInt from 'php-random-int';
import JSON5 from 'json5';
import got from 'got';

import { MAX_TEXT_SIZE, MAX_CONTEXT_ELEMENTS } from '../app.js';
import { who, commas, names, trunc, wss, blame } from '../library/factory';
import { nonthread, anywhere, community } from '../library/listeners';

export default (app: App): void => {
    const SUIT_NAMES = ['Spades', 'Hearts', 'Clubs', 'Diamonds' ];
    const SUIT_EMOJIS = [ ':spades:', ':hearts:', ':clubs:', ':diamonds:' ];

    const re_shuffle = /^!?shuffle\s+(.+)/is;
    app.message(re_shuffle, nonthread, anywhere, async ({ message, context, say }) => {
        try {
            const suit = randomInt(0, 3),
                list = <string>context.matches[1],
                items = shuffle(list.split(','));

            await say({
                username: `Shuffle: ${SUIT_NAMES[suit]}`,
                icon_emoji: SUIT_EMOJIS[suit],
                text: `${who(message, 'You')} shuffled ${items.length != 1 ? 'items' : 'an item'}`,
                blocks: [<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(`${who(message, 'You')} shuffled ${commas(items.map(item => `*${wss(item)}*`))}.`, MAX_TEXT_SIZE)
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
                list = <string>context.matches[2],
                items = shuffle(list.split(',')).slice(0, count);

            await say({
                username: `Draw: ${SUIT_NAMES[suit]}`,
                icon_emoji: SUIT_EMOJIS[suit],
                text: `${who(message, 'You')} drew ${count != 1 ? 'items' : 'an item'}`,
                blocks: [<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(`${who(message, 'You')} drew ${commas(items.map(item => `*${wss(item)}*`))}.`, MAX_TEXT_SIZE)
                    }
                }]
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    type Script = {
        event?: string;
        moderator?: boolean;
        limit?: number;
        values?: Values;
        options?: Options;
        deal?: Deck;
        rules?: Rules;
        url?: string;
    }

    type Values = {
        [key: string]: number;
    }

    type Options = {
        [key: string]: boolean;
    }

    type Deck =
        | string
        | { choose: Quantity; from: Deck; }
        | { choose: Quantity; grouping: Deck[] }
        | { repeat: Quantity; from: Deck; }
        | { repeat: Quantity; grouping: Deck[] }
        | { duplicate: Quantity; of?: Quantity; from: Deck; }
        | { cross: Deck; with: Deck; using?: string; }
        | { zip: Deck; with: Deck; using?: string; }
        | { if: Option; then: Deck; else?: Deck }
        | Deck[]

    type Quantity = Value | Expression
    type Value = number | string;
    type Expression =
        | { value: Quantity; plus: Quantity; }
        | { value: Quantity; minus: Quantity; }
        | { value: Quantity; times: Quantity; }

    type Rules = Rule[];

    type Rule = ShowRule | AnnounceRule
    type ShowRule = Optional & { show: Matchers; to: Matchers; as?: string; }
    type AnnounceRule = Optional & { announce: Matchers; as?: string; }

    type Option = string
    type Optional = { if?: Option; }

    type Matchers = Matcher | Matcher[];
    type Matcher =
        | string
        | { is: string }
        | { isNot: string }
        | { startsWith: string }
        | { startsWithout: string }
        | { endsWith: string }
        | { endsWithout: string }
        | { includes: string }
        | { excludes: string }
        | { matches: string }

    const re_script = /^\{.+\}\s*$/s,
        re_formatted_url = /^<([^|]+?)(?:\|[^|]+)?>$/;
    app.message(re_script, nonthread, community, async ({ message, context, say, client }) => {
        try {
            const suit = randomInt(0, 3),
                script = <Script>JSON5.parse(context.matches[0]);

            if (script.url) {
                const match = script.url.match(re_formatted_url);
                if (match)
                    script.url = match[1];

                try {
                    const extension = await got.get(script.url).json();
                    Object.assign(script, extension);
                    delete script.url;
                }
                catch (err) {
                    throw `Web error \`${err.message}\` on URL \`${script.url}\`.`;
                }
            }

            if (!script.deal)
                throw `Unexpected deal \`${script.deal}\` in script.`;

            const items = build_deck(script.deal, script.values, script.options);

            const users = shuffle((await client.conversations.members({
                token: context.botToken,
                channel: message.channel
            }) as WebAPICallResult & {
                members: string[]
            }).members.filter(user =>
                user != context.botUserId
                && (!script.moderator || user != message.user)
            ));

            const dealt: {
                [user: string]: string[]
            } = {};
            const rounds = script.limit === undefined
                ? Math.ceil(items.length / users.length)
                : Math.min(script.limit, Math.floor(items.length / users.length));
            for (let round = 1; round <= rounds; round++)
                users.forEach(user => {
                    if (items.length > 0) {
                        if (dealt[user])
                            dealt[user].push(items.shift()!);
                        else
                            dealt[user] = [items.shift()!];
                    }
                });

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
                all_summary = `${who(message, 'You')} dealt ${all_list} by direct message${items.length == 0 ? '' : ` with *${items.length}* leftover${script.moderator ? ` for <@${message.user}>` : ''}`}.`,
                all_blocks: Block[] = [<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(all_summary, MAX_TEXT_SIZE)
                    }
                }];

            let announced: string[] = [];
            if (script.rules) {
                enlist(script.rules).filter((rule): rule is AnnounceRule => 'announce' in rule && (!rule.if || validate(rule.if, script.options))).forEach(rule => {
                    enlist(rule.announce).forEach(announce => {
                        Object.keys(dealt).forEach(who => {
                            dealt[who].filter(it => matches(it, announce)).forEach(whose => {
                                const text = trunc(`:eye-in-speech-bubble: You all see that <@${who}> was dealt *${!rule.as ? whose : rule.as}*.`, MAX_TEXT_SIZE);
                                if (!announced.includes(text))
                                announced.push(text);
                            });
                        });
                    });
                });
            }
            if (announced.length > 0) {
                announced = shuffle(announced);

                if (announced.length > MAX_CONTEXT_ELEMENTS)
                    announced = [
                        ...announced.slice(0, MAX_CONTEXT_ELEMENTS - 1),
                        trunc(`:warning: Too many context elements to show (limit of ${MAX_CONTEXT_ELEMENTS}).`, MAX_TEXT_SIZE)
                    ];

                all_blocks.push(<ContextBlock>{
                    type: 'context',
                    elements: announced.map(text => (<MrkdwnElement>{
                        type: 'mrkdwn',
                        text: text
                    }))
                });
            }

            const ts = (await client.chat.postMessage({
                token: context.botToken,
                channel: message.channel,
                username: `Deal: ${SUIT_NAMES[suit]}`,
                icon_emoji: SUIT_EMOJIS[suit],
                text: all_notification,
                blocks: all_blocks
            }) as WebAPICallResult & {
                ts: string
            }).ts;

            const permalink = ts ? (await client.chat.getPermalink({
                channel: message.channel,
                message_ts: ts
            })).permalink : undefined;

            Object.keys(dealt).forEach(async (user) => {
                const per_list = commas(dealt[user].map(item => `*${item}*`)),
                    per_venue = script.event ? `for the *${script.event}* event` : `from the <#${message.channel}> channel`,
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

                let shown: string[] = [];
                if (script.rules) {
                    enlist(script.rules).filter((rule): rule is ShowRule => 'show' in rule && (!rule.if || validate(rule.if, script.options))).forEach(rule => {
                        enlist(rule.to).forEach(to => {
                            dealt[user].filter(it => matches(it, to)).forEach(yours => {
                                enlist(rule.show).forEach(show => {
                                    Object.keys(dealt).filter(them => them != user).forEach(them => {
                                        dealt[them].filter(it => matches(it, show)).forEach(theirs => {
                                            const text = trunc(`:eye-in-speech-bubble: Because you were dealt *${yours}* you see that <@${them}> was dealt *${!rule.as ? theirs : rule.as}*.`, MAX_TEXT_SIZE);
                                            if (!shown.includes(text))
                                                shown.push(text);
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
                if (shown.length > 0) {
                    shown = shuffle(shown);

                    if (shown.length > MAX_CONTEXT_ELEMENTS)
                        shown = [
                            ...shown.slice(0, MAX_CONTEXT_ELEMENTS - 1),
                            trunc(`:warning: Too many context elements to show (limit of ${MAX_CONTEXT_ELEMENTS}).`, MAX_TEXT_SIZE)
                        ];

                    per_blocks.push(<ContextBlock>{
                        type: 'context',
                        elements: shown.map(text => (<MrkdwnElement>{
                            type: 'mrkdwn',
                            text: text
                        }))
                    });
                }

                const dm = (await client.conversations.open({
                    token: context.botToken,
                    users: !script.moderator ? user : `${user},${message.user}`
                }) as WebAPICallResult & {
                    channel: {
                        id: string
                    }
                }).channel.id;

                await client.chat.postMessage({
                    token: context.botToken,
                    channel: dm,
                    username: `Deal: ${SUIT_NAMES[suit]}`,
                    icon_emoji: SUIT_EMOJIS[suit],
                    text: per_notification,
                    blocks: per_blocks
                });
            });

            if (script.moderator && items.length > 0) {
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
                    username: `Deal: ${SUIT_NAMES[suit]}`,
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

    function build_deck(items: Deck, values?: Values, options?: Options): string[] {
        return shuffle(build_subdeck(items, values, options));
    }

    function build_subdeck(items: Deck, values?: Values, options?: Options): string[] {
        if (typeof items === 'string')
            return [wss(items)];
        else if ('choose' in items) {
            if ('from' in items)
                return choose(
                    build_subdeck(items.from, values, options),
                    evaluate(items.choose, values)
                );
            else if ('grouping' in items)
                return build_subdeck(choose(
                    items.grouping,
                    evaluate(items.choose, values)
                ), values, options);
            else
                throw `Unexpected choose \`${JSON.stringify(items)}\` in script.`;
        }
        else if ('repeat' in items) {
            if ('from' in items)
                return repeat(
                    build_subdeck(items.from, values, options),
                    evaluate(items.repeat, values)
                );
            else if ('grouping' in items)
                return build_subdeck(repeat(
                    items.grouping,
                    evaluate(items.repeat, values)
                ), values, options);
            else
                throw `Unexpected choose \`${JSON.stringify(items)}\` in script.`;
        }
        else if ('duplicate' in items)
            return repeat(
                choose(
                    build_subdeck(items.from, values, options),
                    items.of ? evaluate(items.of, values) : 1
                ),
                evaluate(items.duplicate, values)
            );
        else if ('cross' in items)
            return cross(
                build_subdeck(items.cross, values, options),
                build_subdeck(items.with, values, options),
                items.using
            );
        else if ('zip' in items)
            return zip(
                build_subdeck(items.zip, values, options),
                build_subdeck(items.with, values, options),
                items.using
            );
        else if ('if' in items)
            return validate(items.if, options)
                ? build_subdeck(items.then, values, options)
                : ( items.else ? build_subdeck(items.else, values, options) : [] );
        else if (Array.isArray(items))
            return items.map(
                item => build_subdeck(item, values, options)
            ).flat();
        else
            throw `Unexpected deck \'${JSON.stringify(items)}\` in script.`;
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
        if (quantity > list.length || quantity < 0)
            throw `Unexpected choose quantity \`${quantity}\` for list \`${JSON.stringify(list)}\` in script.`;

        return shuffle(list).slice(list.length - quantity);
    }

    function repeat<T>(list: T[], quantity: number): T[] {
        if (quantity < 0)
            throw `Unexpected repeat quantity \`${quantity}\` for list \`${JSON.stringify(list)}\` in script.`;

        if (list.length == 0)
            throw 'Unexpected empty list in script.';

        const build = [];
        for (let i = 1; i <= quantity; i++)
            build.push(list[randomInt(0, list.length - 1)]);
        return build;
    }

    function cross<T>(list1: T[], list2: T[], join?: T): string[] {
        const build = [];
        for (let i = 0; i < list1.length; i++)
            for (let j = 0; j < list2.length; j++)
                build.push(`${list1[i]} ${join ? `${join}` : '\u2022'} ${list2[j]}`);
        return shuffle(build);
    }

    function zip<T>(list1: T[], list2: T[], join?: T): string[] {
        const build = [],
            copy1 = shuffle(list1),
            copy2 = shuffle(list2);
        for (let i = 0; i < Math.min(list1.length, list2.length); i++)
            build.push(wss(`${copy1[i]} ${join ? `${join}` : '\u2022'} ${copy2[i]}`));
        return build;
    }

    function evaluate(it: Quantity, values?: Values): number {
        if (typeof it === 'number')
            return it;
        else if (typeof it === 'string')
            if (values !== undefined && values[it] !== undefined)
                return values[it];
            else
                throw `Unknown value \`${JSON.stringify(it)}\` in script.`;
        else if ('plus' in it)
            return evaluate(it.value, values) + evaluate(it.plus, values);
        else if ('minus' in it)
            return evaluate(it.value, values) - evaluate(it.minus, values);
        else if ('times' in it)
            return evaluate(it.value, values) * evaluate(it.times, values);
        else
            throw `Unexpected expression \'${JSON.stringify(it)}\` in script.`;
    }

    function validate(it: Option, options?: Options): boolean {
        return options !== undefined && options[it] === true;
    }

    function matches(it: string, matcher: Matcher): boolean {
        if (typeof matcher === 'string')
            return it == wss(matcher);
        else if ('is' in matcher)
            return it == wss(matcher.is);
        if ('isNot' in matcher)
            return it != wss(matcher.isNot);
        else if ('startsWith' in matcher)
            return it.startsWith(wss(matcher.startsWith));
        else if ('startsWithout' in matcher)
            return !it.startsWith(wss(matcher.startsWithout));
        else if ('endsWith' in matcher)
            return it.endsWith(wss(matcher.endsWith));
        else if ('endsWithout' in matcher)
            return !it.endsWith(wss(matcher.endsWithout));
        else if ('includes' in matcher)
            return it.includes(wss(matcher.includes));
        else if ('excludes' in matcher)
            return !it.includes(wss(matcher.excludes));
        else if ('matches' in matcher)
            return it.match(wss(matcher.matches)) != null;
        else
            throw `Unexpected matcher \'${JSON.stringify(matcher)}\` in script.`;
    }
};
