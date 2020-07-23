import { App, MessageEvent, Context, BlockAction, MultiStaticSelectAction, SayFn } from '@slack/bolt';
import { WebClient, Block, SectionBlock, ContextBlock, MultiSelect, MrkdwnElement, WebAPICallResult } from '@slack/web-api';
import { MongoClient } from 'mongodb';

import randomInt from 'php-random-int';
import JSON5 from 'json5';
import got from 'got';

import { MAX_TEXT_SIZE, MAX_CONTEXT_ELEMENTS } from '../app.js';
import { commas, names, trunc, wss, blame } from '../library/factory';
import { nonthread, anywhere, community } from '../library/listeners';

const MAX_IMPORTS = 5;

// TODO refactor monolithic component

export default (app: App, store: Promise<MongoClient>): void => {
    const re_shuffle = /^!?shuffle\s+(.+)/is;
    app.message(re_shuffle, nonthread, anywhere, async ({ message, context, say, client }) => {
        try {
            await process(
                'Shuffle',
                context.matches[1],
                items => shuffle(items),
                0,
                message, context, say, client
            );
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_draw = /^!?draw\s+(?:([1-9][0-9]*)\s+(?:from|of)\s+)?(.+)/is;
    app.message(re_draw, nonthread, anywhere, async ({ message, context, say, client }) => {
        try {
            await process(
                'Draw',
                context.matches[2],
                items => choose(items, context.matches[1] ?? 1),
                0,
                message, context, say, client
            );
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_pool = /^!?pool\s+(?:([1-9][0-9]*)\s+(?:from|of)\s+)?(.+)/is;
    app.message(re_pool, nonthread, anywhere, async ({ message, context, say, client }) => {
        try {
            await process(
                'Pool',
                context.matches[2],
                items => repeat(items, context.matches[1] ?? 1),
                0,
                message, context, say, client
            );
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const SUIT_EMOJIS: ({
        [suit: string]: string
    }) = {
        'Spades': ':spades:',
        'Hearts': ':hearts:',
        'Clubs': ':clubs:',
        'Diamonds': ':diamonds:',
        'Stars': ':star:'
    };

    const MODE_WORD: ({
        [mode: string]: {
            did: string,
            redo: string,
            redid: string
        }
    }) = {
        'Shuffle': {
            did: 'Shuffled',
            redo: 'Reshuffle',
            redid: 'Reshuffled'
        },
        'Draw': {
            did: 'Drew',
            redo: 'Redraw',
            redid: 'Redrew'
        },
        'Pool': {
            did: 'Pooled',
            redo: 'Repool',
            redid: 'Repooled'
        }
    };

    const re_macro = /^[\w_][\w\d_]{2,14}$/;
    async function process(
        mode: string,
        expression: string,
        fun: (list: string[]) => string[],
        recount: number,
        message: MessageEvent,
        context: Context,
        say: SayFn,
        client: WebClient
    ): Promise<void> {
        const suit = pluck(SUIT_EMOJIS);

        let list = <string[]>expression.split(',').map(it => it.trim());
        if (list.length == 1) {
            if (Number(list[0]) >= 1 && Number(list[0]) % 1 == 0)
                list = Array(Number(list[0])).fill(1).map((v, i) => String(v + i));
            else if (list[0] == '<!channel>')
                list = (await members(message.channel, context, client)).map(user => `<@${user}>`);
            else if (re_macro.test(list[0]))
                list = (await macro(store, context, message.user, list[0])).split(',').map(it => it.trim());
        }

        const items = fun(list);

        await client.chat.postMessage({
            token: context.botToken,
            channel: message.channel,
            username: `${mode}: ${suit}`,
            icon_emoji: SUIT_EMOJIS[suit],
            text: `<@${message.user}> ${MODE_WORD[mode].did.toLowerCase()} ${list.length != 1 ? 'items' : 'an item'}`,
            blocks: [
                <SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(`<@${message.user}> ${MODE_WORD[mode].did.toLowerCase()} ${commas(items.map(item => `*${wss(item)}*`))}.`, MAX_TEXT_SIZE)
                    }
                },
                ...(mode == 'Pool' ? [
                    <SectionBlock>{
                        type: 'section',
                        block_id: `deck_message_block_${message.user}_${JSON.stringify(list)}`,
                        text: {
                            type: 'mrkdwn',
                            text: ':left_speech_bubble: These results are original.'
                        },
                        accessory: <MultiSelect>{
                            type: 'multi_static_select',
                            action_id: `deck_message_select_${mode}_${recount+1}_${JSON.stringify(items.map(item => list.indexOf(item)))}`,
                            placeholder: {
                                type: 'plain_text',
                                emoji: true,
                                text: MODE_WORD[mode].redo
                            },
                            options: items.map((item, index) => ({
                                text: {
                                    type: 'plain_text',
                                    emoji: true,
                                    text: `${item}`
                                },
                                value: `${index}`
                            }))
                        }
                    }
                ] : [])
            ]
        });
    }

    const re_action_id = /^deck_message_select_(\w+)_(\d+)_(\[[^\]]+\])$/,
        re_block_id = /^deck_message_block_(U\w+)_(\[[^\]]+\])$/;
    app.action<BlockAction>(re_action_id, async ({ ack, respond, body, action, }) => {
        await ack();

        const user = body.user.id,
            selected = (action as MultiStaticSelectAction).selected_options
                .map(it => Number(it.value)).sort(),
            [, mode, str_recount, json_items ] = action.action_id.match(re_action_id) ?? [],
            [, whom, json_list ] = action.block_id.match(re_block_id) ?? [],
            recount = Number(str_recount),
            list = <string[]>JSON.parse(json_list),
            items = (<number[]>JSON.parse(json_items)).map(index => list[index]);

        if (user != whom)
            return await respond({
                replace_original: false,
                response_type: 'ephemeral',
                text: `That ${mode.toLowerCase()} belongs to <@${whom}>.`
            });

        if (mode == 'Pool') {
            selected.forEach(index => {
                items[index] = repeat(list, 1)[0];
            });

            const text = (body as BlockAction).message!.text!,
                blocks = [
                    <SectionBlock>{
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: trunc(`<@${user}> ${MODE_WORD[mode].did.toLowerCase()} ${commas(items.map(item => `*${wss(item)}*`))}.`, MAX_TEXT_SIZE)
                        }
                    },
                    <SectionBlock>{
                        type: 'section',
                        block_id: `deck_message_block_${user}_${JSON.stringify(list)}`,
                        text: {
                            type: 'mrkdwn',
                            text: `:eye-in-speech-bubble: The results are ${MODE_WORD[mode].redid.toLowerCase()} *${recount}* time${recount != 1 ? 's' : ''}.`
                        },
                        accessory: <MultiSelect>{
                            type: 'multi_static_select',
                            action_id: `deck_message_select_${mode}_${recount+1}_${JSON.stringify(items.map(item => list.indexOf(item)))}`,
                            placeholder: {
                                type: 'plain_text',
                                emoji: true,
                                text: MODE_WORD[mode].redo
                            },
                            options: items.map((item, index) => ({
                                text: {
                                    type: 'plain_text',
                                    emoji: true,
                                    text: `${item}`
                                },
                                value: `${index}`
                            }))
                        }
                    }
                ];

            respond({
                replace_original: true,
                text: text,
                blocks: blocks
            });
        }
        else throw `Unsupported mode \`${mode}\` on redo.`;
    });

    async function macro(store: Promise<MongoClient>, context: Context, user: string, name: string): Promise<string> {
        const coll = (await store).db().collection('macros');
        return (await coll.findOne(
            { _id: user },
            { projection: { _id: 0} }
        ) || {})[name]
        ?? (await coll.findOne(
            { _id: context.botUserId },
            { projection: { _id: 0} }
        ) || {})[name]
        ?? name;
    }

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
                                const text = trunc(`${!rule.as ? ':eye-in-speech-bubble:' : ':left_speech_bubble:'} You all see that <@${who}> was dealt ${!rule.as ? `*${whose}*` : `*${rule.as}* as an alias`}.`, MAX_TEXT_SIZE);
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
                username: `Deal: ${suit}`,
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
                                            const text = trunc(`${!rule.as ? ':eye-in-speech-bubble:' : ':left_speech_bubble:'} Because you were dealt *${yours}* you see that <@${them}> was dealt ${!rule.as ? `*${theirs}*` : `*${rule.as}* as an alias`}.`, MAX_TEXT_SIZE);
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
                        username: `Deal: ${suit}`,
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
                    username: `Deal: ${suit}`,
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

    function pluck(object: Record<string, unknown>): string {
        return choose(Object.keys(object), 1)[0];
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
