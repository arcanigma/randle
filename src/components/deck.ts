import { App, MessageEvent, Context } from '@slack/bolt';
import { WebClient, Block, SectionBlock, ContextBlock, MrkdwnElement, WebAPICallResult } from '@slack/web-api';

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
    app.message(re_shuffle, nonthread, anywhere, async ({ message, context, say, client }) => {
        try {
            const suit = randomInt(0, 3),
                list = <string[]>context.matches[1].trim().split(',');

            let items;
            if (list.length == 1 && list[0] == '<!channel>')
                items = (await members(message.channel, context, client))
                    .map(user => `<@${user}>`);
            else
                items = list;
            items = shuffle(items);

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
    app.message(re_draw, nonthread, anywhere, async ({ message, context, say, client }) => {
        try {
            const suit = randomInt(0, 3),
                count = context.matches[1] ?? 1,
                list = <string[]>context.matches[2].trim().split(',');

            let items;
            if (list.length == 1 && list[0] == '<!channel>')
                items = (await members(message.channel, context, client))
                    .map(user => `<@${user}>`);
            else
                items = list;
            items = shuffle(items).slice(0, count);

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
        moderator?: Option;
        limit?: Value;
        values?: Values;
        options?: Options;
        deal?: Deck;
        rules?: Rules;
        import?: string | string[];
    }

    type Values = { [key: string]: Value; }
    type Value =
        | number
        | string
        | { plus: Value[]; }
        | { minus: Value[]; }
        | { times: Value[]; }
        | { max: Value[]; }
        | { min: Value[]; }

    type Options = { [key: string]: boolean; }
    type Option =
        | boolean
        | string
        | { and: Option[]; }
        | { or: Option[]; }
        | { not: Option; }

    type Deck =
        | string
        | { choose: Value; from: Deck; }
        | { choose: Value; grouping: Deck[]; }
        | { repeat: Value; from: Deck; }
        | { repeat: Value; grouping: Deck[]; }
        | { duplicate: Value; of?: Value; from: Deck; }
        | { cross: Deck; with: Deck; using?: string; }
        | { zip: Deck; with: Deck; using?: string; }
        | { if: Option; then: Deck; else?: Deck; }
        | Deck[]

    type Rules = Rule | Rule[];
    type Rule = (
        | ShowRule
        | AnnounceRule
    ) & Conditional
    type ShowRule = { show: Matchers; to: Matchers; as?: string; }
    type AnnounceRule = { announce: Matchers; as?: string; }
    type Conditional = { if?: Option; }

    type Matchers = Matcher | Matcher[];
    type Matcher =
        | string
        | { is: string; }
        | { isNot: string; }
        | { startsWith: string; }
        | { startsWithout: string; }
        | { endsWith: string; }
        | { endsWithout: string; }
        | { includes: string; }
        | { excludes: string; }
        | { matches: string; }

    const MAX_IMPORTS = 5;

    const re_script = /^[`\s]*(\{.+\})[`\s]*$/s,
        re_url = /^\s*<([^|]+)(?:\|[^|]+)?>\s*$/;
    app.message(re_script, nonthread, community, async ({ message, context, say, client }) => {
        try {
            const suit = randomInt(0, 3),
                script = <Script>JSON5.parse(context.matches[1]);

            if (script.import) {
                if (Array.isArray(script.import) && script.import.length > MAX_IMPORTS)
                    throw `Too many imports (limit of ${MAX_IMPORTS}) in script.`;

                try {
                    const imports = [];
                    for (let url of enlist(script.import)) {
                        const match = url.match(re_url);
                        if (match)
                            url = match[1];
                        imports.push(await got.get(url).json());
                    }
                    Object.assign(script, ...imports);
                    delete script.import;
                }
                catch (err) {
                    throw `Web error \`${err.message}\` for \`${JSON.stringify(script.import)}\` URL.`;
                }
            }

            if (!script.deal)
                throw `Unexpected deal \`${JSON.stringify(script.deal)}\` in script.`;

            const items = build_deck(script.deal, script.values, script.options),
                users = (await members(message.channel, context, client))
                    .filter(user => user != message.user || !validate(script.moderator, script.options));

            const dealt: {
                [user: string]: string[]
            } = {};
            const limit = evaluate(script.limit, script.values),
                rounds = !limit
                    ? Math.ceil(items.length / users.length)
                    : Math.min(limit, Math.floor(items.length / users.length));
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
            users.filter(user => dealt[user]).forEach(user => {
                const count = dealt[user].length;
                if (!counts[count])
                    counts[count] = [user];
                else
                    counts[count].push(user);
            });

            const all_list = commas(Object.keys(counts).map(Number).sort().reverse().map(count => {
                    return `${count > 0 ? `*${count}* each` : '*none*'} to ${names(counts[count])}`;
                }), '; '),
                all_leftover = items.length == 0 ? '' : ` with *${items.length}* leftover${!validate(script.moderator, script.options) ? '' : ` for <@${message.user}> as the moderator`}`,
                all_notification = `<@${message.user}> dealt items`,
                all_summary = `<@${message.user}> dealt ${all_list} by direct message${all_leftover}.`,
                all_blocks: Block[] = [<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(all_summary, MAX_TEXT_SIZE)
                    }
                }];

            let announced: string[] = [];
            if (script.rules) {
                enlist(script.rules).filter((rule): rule is AnnounceRule => 'announce' in rule && validate(rule.if ?? true, script.options)).forEach(rule => {
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

            for (const user of Object.keys(dealt)) {
                const per_list = commas(dealt[user].map(item => `*${item}*`)),
                    per_venue = script.event ? `for the *${script.event}* event` : `from the <#${message.channel}> channel`,
                    per_who = message.user != user ? `<@${message.user}>${(!validate(script.moderator, script.options) ? '' : ' as the moderator')}` : 'You',
                    per_whom = message.user != user ? (validate(script.moderator, script.options) ? `<@${user}>` : 'you') : 'yourself',
                    per_notification = `${per_who} dealt ${per_whom} ${dealt[user].length != 1 ? 'items' : 'an item'}`,
                    per_summary = `${per_who} dealt ${per_whom} ${per_list} ${per_venue} <!date^${parseInt(message.ts)}^{date_short_pretty} at {time}^${permalink}|there>.`,
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
                    enlist(script.rules).filter((rule): rule is ShowRule => 'show' in rule && validate(rule.if ?? true, script.options)).forEach(rule => {
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

                try {
                    const dm = (await client.conversations.open({
                        token: context.botToken,
                        users: !validate(script.moderator, script.options)
                            ? user
                            : `${user},${message.user}`
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
                }
                catch (err) {
                    if (err.data.error != 'cannot_dm_bot') throw err;
                }
            }

            if (items.length > 0 && validate(script.moderator, script.options)) {
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
                    text: `You dealt with leftover${items.length != 1 ? 's' : ''}`,
                    blocks: [<SectionBlock>{
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: trunc(`You as the moderator dealt to ${names(Object.keys(dealt))} with ${commas(items.map(item => `*${item}*`))} leftover.`, MAX_TEXT_SIZE)
                        }
                    }]
                });
            }
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    async function members(channel: string, context: Context, client: WebClient) {
        return shuffle((await client.conversations.members({
            token: context.botToken,
            channel: channel
        }) as WebAPICallResult & {
            members: string[]
        }).members.filter(user =>
            user != context.botUserId
        ));
    }

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
                throw `Unexpected repeat \`${JSON.stringify(items)}\` in script.`;
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
            throw `Unexpected choose quantity \`${JSON.stringify(quantity)}\` for list \`${JSON.stringify(list)}\` in script.`;

        return shuffle(list).slice(list.length - quantity);
    }

    function repeat<T>(list: T[], quantity: number): T[] {
        if (quantity < 0)
            throw `Unexpected repeat quantity \`${JSON.stringify(quantity)}\` for list \`${JSON.stringify(list)}\` in script.`;

        if (list.length == 0)
            throw 'Unexpected empty list in script.';

        const build = [];
        for (let i = 1; i <= quantity; i++)
            build.push(list[randomInt(0, list.length - 1)]);
        return build;
    }

    function cross<T>(list1: T[], list2: T[], delimiter?: T): string[] {
        const build = [];
        for (let i = 0; i < list1.length; i++)
            for (let j = 0; j < list2.length; j++)
                build.push(`${list1[i]}${delimiter ?? ' \u2022 '}${list2[j]}`);
        return shuffle(build);
    }

    function zip<T>(list1: T[], list2: T[], delimiter?: T): string[] {
        const build = [],
            copy1 = shuffle(list1),
            copy2 = shuffle(list2);
        for (let i = 0; i < Math.min(list1.length, list2.length); i++)
            build.push(wss(`${copy1[i]}${delimiter ?? ' \u2022 '}${copy2[i]}`));
        return build;
    }

    function evaluate(it: Value | undefined, values?: Values): number {
        if (it === undefined)
            return 0;
        if (typeof it === 'number')
            return it;
        else if (typeof it === 'string') {
            if (values !== undefined && values[it] !== undefined)
                return values[it] = evaluate(
                    values[it],
                    Object.assign({}, values, { [it]: undefined })
                );
            else if (values !== undefined && Object.keys(values).includes(it))
                throw `Recursive value \`${JSON.stringify(it)}\` in script.`;
            else
                throw `Undefined value \`${JSON.stringify(it)}\` in script.`;
        }
        else if ('plus' in it)
            return <number>it.plus.reduce((x, y) => evaluate(x, values) + evaluate(y, values));
        else if ('minus' in it)
            return <number>it.minus.reduce((x, y) => evaluate(x, values) - evaluate(y, values));
        else if ('times' in it)
            return <number>it.times.reduce((x, y) => evaluate(x, values) * evaluate(y, values));
        else if ('max' in it)
            return Math.max(...it.max.map(x => evaluate(x, values)));
        else if ('min' in it)
            return Math.min(...it.min.map(x => evaluate(x, values)));
        else
            throw `Unexpected value \'${JSON.stringify(it)}\` in script.`;
    }

    function validate(it: Option | undefined, options?: Options): boolean {
        if (it === undefined)
            return false;
        if (typeof it === 'boolean')
            return it;
        else if (typeof it === 'string') {
            if (options !== undefined && options[it] !== undefined)
                return options[it] = validate(
                    options[it],
                    Object.assign({}, options, { [it]: undefined })
                );
            else if (options !== undefined && Object.keys(options).includes(it))
                throw `Recursive option \`${JSON.stringify(it)}\` in script.`;
            else
                throw `Undefined option \`${JSON.stringify(it)}\` in script.`;
        }
        else if ('and' in it)
            return it.and.every(opt => validate(opt, options));
        else if ('or' in it)
            return it.or.some(opt => validate(opt, options));
        else if ('not' in it)
            return !validate(it.not, options);
        else
            throw `Unexpected option \'${JSON.stringify(it)}\` in script.`;
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
