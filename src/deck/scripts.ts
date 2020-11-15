import { App, BlockAction, MultiStaticSelectAction } from '@slack/bolt';
import { Block, ContextBlock, MrkdwnElement, MultiSelect, SectionBlock, WebAPICallResult } from '@slack/web-api';
import { ElementDefinition } from 'cytoscape';
import got from 'got';
import JSON5 from 'json5';
import ordinal from 'ordinal';
import { MAX_CONTEXT_ELEMENTS, MAX_TEXT_SIZE } from '../app';
import { commas, names, trunc } from '../library/factory';
import { community, nonthread } from '../library/listeners';
import { getMembers } from '../library/lookup';
import { blame } from '../library/messages';
import { AnnounceRule, ExplainRule, GraphRule, Items, Rules, Script, ShowRule, SUIT_EMOJIS } from './deck';
import { uploadGraphFile } from './graphing';
import { build, enable, evaluate, listify, matches, pluck, shuffleCopy, shuffleInPlace, validate } from './solving';

export const MAX_IMPORTS = 5;

// TODO interactive scripting with modal

export const register = ({ app }: { app: App }): void => {
    const re_script = /^[`\s]*(\{.+\})[`\s]*$/s,
        re_url = /^\s*<([^|]+)(?:\|[^|]+)?>\s*$/;
    app.message(re_script, nonthread, community, async ({ message, context, client }) => {
        try {
            const suit = pluck(SUIT_EMOJIS);

            const script = <Script>JSON5.parse((<string[]> context.matches)[1]);
            if (script.import) {
                if (Array.isArray(script.import) && script.import.length > MAX_IMPORTS)
                    throw `Too many imports (limit of ${MAX_IMPORTS}) in script.`;

                for (let url of listify(script.import)) {
                    const match = re_url.exec(url);
                    if (match)
                        url = match[1];

                    let raw;
                    try {
                        raw = await got.get(url).text();
                    }
                    catch (error) {
                        throw `Web error \`${(<{ message: string }> error).message}\` for \`${url}\` import.`;
                    }

                    let iscript;
                    try {
                        iscript = <Script>JSON5.parse(raw);
                    }
                    catch (error) {
                        throw `Parse error \`${(<{ message: string }> error).message}\` for \`${url}\` import.`;
                    }

                    if ('import' in iscript)
                        throw `Forbidden nested import \`${JSON.stringify(iscript.import)}\` in \`${url}\` import.`;

                    if ('event' in iscript)
                        script.event = script.event !== undefined
                            ? `${script.event} \u2022 ${<string> iscript.event}`
                            : iscript.event;

                    if ('moderator' in iscript)
                        script.moderator = iscript.moderator;

                    if ('limit' in iscript)
                        script.limit = iscript.limit;

                    if ('deal' in iscript)
                        script.deal = <Items> listify([ script.deal, iscript.deal ]);

                    if ('rules' in iscript)
                        script.rules = <Rules> listify([ script.rules, iscript.rules ]);

                    if ('sets' in iscript)
                        script.sets = Object.assign(script.sets ?? {}, iscript.sets);

                    if ('values' in iscript)
                        script.values = Object.assign(script.values ?? {}, iscript.values);

                    if ('options' in iscript)
                        script.options = Object.assign(script.options ?? {}, iscript.options);
                }

                delete script.import;
            }

            if (!script.deal)
                throw `Unexpected deal \`${JSON.stringify(script.deal)}\` in script.`;

            const items = shuffleCopy(build(script.deal, script)),
                draft = items.filter((item, index) => items.indexOf(item) === index),
                users = shuffleInPlace((await getMembers(message.channel, context, client))
                    .filter(user => user != message.user || !validate(script.moderator, script.options)));

            const graph: ElementDefinition[] = [];
            if (script.rules && listify(script.rules).some(rule => 'graph' in rule)) {
                listify(script.rules).filter((rule): rule is GraphRule => 'graph' in rule && enable(rule, draft, script.options)).forEach(rule => {
                    listify(rule.graph).forEach(node => {
                        draft.filter(it => matches(it, node, script)).forEach(which => {
                            const edge = graph.find(node => node.data.id == which);
                            if (edge === undefined)
                                graph.push(<ElementDefinition>{
                                    group: 'nodes',
                                    data: {
                                        id: which,
                                        color: rule.color
                                    }
                                });
                            else
                                edge.data.color = rule.color;
                        });
                    });
                });

                if (graph.length > 0)
                    listify(script.rules).filter((rule): rule is ShowRule => 'show' in rule && enable(rule, draft, script.options)).forEach(rule => {
                        listify(rule.to).forEach(to => {
                            draft.filter(it => matches(it, to, script)).forEach(yours => {
                                listify(rule.show).forEach(show => {
                                    draft.filter(it => matches(it, show, script) && (!rule.loopless || it != yours)).forEach(theirs => {
                                        // TODO merge parallel edges
                                        graph.push(<ElementDefinition>{
                                            group: 'edges',
                                            data: {
                                                source: yours,
                                                target: theirs,
                                                arrow: !rule.as ? 'triangle' : 'triangle-tee'
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
            }

            const dealt: {
                [user: string]: string[];
            } = {};
            const limit = evaluate(script.limit, script.values),
                rounds = !limit
                    ? Math.ceil(items.length / users.length)
                    : Math.min(limit, Math.floor(items.length / users.length));
            for (let round = 1; round <= rounds; round++)
                users.forEach(user => {
                    if (items.length > 0) {
                        if (dealt[user])
                            dealt[user].push(<string>items.shift());
                        else
                            dealt[user] = [<string>items.shift()];
                    }
                });

            if (Object.keys(dealt).length == 0)
                throw 'You must deal at least 1 item.';

            const counts: {
                [count: number]: string[];
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
                all_summary = `<@${message.user}> dealt ${all_list} by direct message${all_leftover} for ${script.event ? `the *${script.event}*` : 'this'} event.`,
                all_blocks: Block[] = [
                    <SectionBlock>{
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: trunc(all_summary, MAX_TEXT_SIZE)
                        }
                    }
                ];

            let publish: string[] = [];
            if (script.rules) {
                listify(script.rules).filter((rule): rule is AnnounceRule => 'announce' in rule && enable(rule, draft, script.options)).forEach(rule => {
                    listify(rule.announce).forEach(announce => {
                        Object.keys(dealt).forEach(who => {
                            dealt[who].filter(it => matches(it, announce, script)).forEach(whose => {
                                const text = trunc(`:${!rule.as ? 'eye-in-speech-bubble' : 'left_speech_bubble'}: You all see that <@${who}> was dealt ${!rule.as ? `*${whose}*` : `*${rule.as}* as an alias`}.`, MAX_TEXT_SIZE);
                                if (!publish.includes(text))
                                    publish.push(text);
                            });
                        });
                    });
                });

                publish = shuffleCopy(publish);

                listify(script.rules).filter((rule): rule is ExplainRule => 'explain' in rule && enable(rule, draft, script.options)).forEach(rule => {
                    const text = trunc(`:${!rule.emoji ? 'information_source' : rule.emoji}: ${rule.explain}.`, MAX_TEXT_SIZE);
                    publish.push(text);
                });
            }
            if (publish.length > 0) {
                if (publish.length > MAX_CONTEXT_ELEMENTS)
                    publish = [
                        ...publish.slice(0, MAX_CONTEXT_ELEMENTS - 1),
                        trunc(`:warning: Too many context elements to show (limit of ${MAX_CONTEXT_ELEMENTS}).`, MAX_TEXT_SIZE)
                    ];

                all_blocks.push(<ContextBlock>{
                    type: 'context',
                    elements: publish.map(text => <MrkdwnElement>{
                        type: 'mrkdwn',
                        text: text
                    })
                });
            }

            const ts = (await client.chat.postMessage({
                token: <string> context.botToken,
                channel: message.channel,
                username: `Deal: ${suit}`,
                icon_emoji: SUIT_EMOJIS[suit],
                text: all_notification,
                blocks: all_blocks
            }) as WebAPICallResult & {
                ts: string;
            }).ts;

            const permalink = <string> (await client.chat.getPermalink({
                channel: message.channel,
                message_ts: ts
            })).permalink;

            for (const user of Object.keys(dealt)) {
                const per_list = commas(dealt[user].map(item => `*${item}*`)),
                    per_venue = script.event ? `for the *${script.event}* event` : `from the <#${message.channel}> channel`,
                    per_when = `<!date^${parseInt(message.ts)}^{date_short_pretty} at {time}^${permalink}|there>`,
                    per_who = message.user != user ? `<@${message.user}>${!validate(script.moderator, script.options) ? '' : ' as the moderator'}` : 'You',
                    per_whom = message.user != user ? validate(script.moderator, script.options) ? `<@${user}>` : 'you' : 'yourself',
                    per_notification = `${per_who} dealt ${per_whom} ${dealt[user].length != 1 ? 'items' : 'an item'}`,
                    per_summary = `${per_who} dealt ${per_whom} ${per_list} ${per_venue} ${per_when}.`,
                    per_blocks: Block[] = [];

                per_blocks.push(<SectionBlock>{
                    type: 'section',
                    block_id: `script_message_block_${user}_${message.ts}_${JSON.stringify(permalink)}`,
                    text: {
                        type: 'mrkdwn',
                        text: trunc(per_summary, MAX_TEXT_SIZE)
                    },
                    // TODO reveal where (audience)
                    accessory: <MultiSelect>{
                        type: 'multi_static_select',
                        action_id: `script_message_select_${message.channel}_${JSON.stringify(script.event)}_${suit}`,
                        placeholder: {
                            type: 'plain_text',
                            text: 'Reveal'
                        },
                        options: dealt[user].map((item, index) => ({
                            text: {
                                type: 'plain_text',
                                emoji: true,
                                text: trunc(`${ordinal(index+1)} \u2022 ${item}`, 75)
                            },
                            value: trunc(item, 75)
                        }))
                    }
                });

                let shown: string[] = [];
                if (script.rules) {
                    listify(script.rules).filter((rule): rule is ShowRule => 'show' in rule && enable(rule, draft, script.options)).forEach(rule => {
                        listify(rule.to).forEach(to => {
                            dealt[user].filter(it => matches(it, to, script)).forEach(yours => {
                                listify(rule.show).forEach(show => {
                                    Object.keys(dealt).forEach(them => {
                                        dealt[them].filter(it => matches(it, show, script) && (!rule.loopless || it != yours)).forEach(theirs => {
                                            const text = trunc(`:${!rule.as ? 'eye-in-speech-bubble' : 'left_speech_bubble'}: Because you were dealt *${yours}* you see that ${them != user ? `<@${them}> was` : 'you were also'} dealt ${!rule.as ? `*${theirs}*` : `*${rule.as}* as an alias`}.`, MAX_TEXT_SIZE);
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
                    shown = shuffleCopy(shown);

                    if (shown.length > MAX_CONTEXT_ELEMENTS)
                        shown = [
                            ...shown.slice(0, MAX_CONTEXT_ELEMENTS - 1),
                            trunc(`:warning: Too many context elements to show (limit of ${MAX_CONTEXT_ELEMENTS}).`, MAX_TEXT_SIZE)
                        ];

                    per_blocks.push(<ContextBlock>{
                        type: 'context',
                        elements: shown.map(text => <MrkdwnElement>{
                            type: 'mrkdwn',
                            text: text
                        })
                    });
                }

                try {
                    const dm = (await client.conversations.open({
                        token: <string> context.botToken,
                        users: !validate(script.moderator, script.options)
                            ? user
                            : `${user},${message.user}`
                    }) as WebAPICallResult & {
                        channel: {
                            id: string;
                        };
                    }).channel.id;

                    await client.chat.postMessage({
                        token: <string> context.botToken,
                        channel: dm,
                        username: `Deal: ${suit}`,
                        icon_emoji: SUIT_EMOJIS[suit],
                        text: per_notification,
                        blocks: per_blocks
                    });
                }
                catch (error) {
                    if ((<{ data: { error: string } }> error).data.error != 'cannot_dm_bot') throw error;
                }
            }

            if (items.length > 0 && validate(script.moderator, script.options)) {
                const dm = (await client.conversations.open({
                    token: <string> context.botToken,
                    users: message.user
                }) as WebAPICallResult & {
                    channel: {
                        id: string;
                    };
                }).channel.id;

                await client.chat.postMessage({
                    token: <string> context.botToken,
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

            if (graph.length > 0)
                await uploadGraphFile({ title: `Graph: ${script.event ?? 'Event'}`,
                    elements: graph,
                    script, message, context, client
                });
        }
        catch (error) {
            await blame({ error: <string|Error> error, message, context, client });
        }
    });

    const re_action_id = /^script_message_select_(C\w+)_("[^"]+")_(\w+)$/,
        re_block_id = /^script_message_block_(U\w+)_([\d]+\.[\d]+)_("[^"]+")$/;
    app.action<BlockAction<MultiStaticSelectAction>>(re_action_id, async ({ ack, body, action, context, client, respond }) => {
        await ack();

        const user = body.user.id,
            revealed = action.selected_options
                .map(it => it.value),
            [ , channel, json_event, suit ] = re_action_id.exec(action.action_id) ?? [],
            [ , whom, timestamp, json_permalink ] = re_block_id.exec(action.block_id) ?? [],
            event = <string>JSON.parse(json_event),
            permalink = <string>JSON.parse(json_permalink);

        if (user != whom)
            return void respond({
                replace_original: false,
                response_type: 'ephemeral',
                text: `These items belong to <@${whom}>.`
            });

        if (revealed.length < 1)
            return void respond({
                replace_original: false,
                response_type: 'ephemeral',
                text: 'You have to select 1 or more items to reveal.'
            });

        const all_list = commas(revealed.map(item => `*${item}*`)),
            all_notification = `<@${user}> revealed ${revealed.length != 1 ? 'items' : 'an item'}`,
            all_venue = `for ${event ? `the *${event}*` : 'this'} event`,
            all_when = `<!date^${parseInt(timestamp)}^{date_short_pretty} at {time}^${permalink}|here>`,
            all_summary = `<@${user}> revealed that they were dealt ${all_list} ${all_venue} ${all_when}.`,
            all_blocks: Block[] = [
                <SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(all_summary, MAX_TEXT_SIZE)
                    }
                }
            ];

        await client.chat.postMessage({
            token: <string> context.botToken,
            channel: channel,
            username: `Deal: ${suit}`,
            icon_emoji: SUIT_EMOJIS[suit],
            text: all_notification,
            blocks: all_blocks
        });
    });
};
