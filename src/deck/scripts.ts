import { App } from '@slack/bolt';
import { Block, ContextBlock, MrkdwnElement, SectionBlock, WebAPICallResult } from '@slack/web-api';
import { ElementDefinition } from 'cytoscape';
import got from 'got';
import JSON5 from 'json5';
import { MAX_CONTEXT_ELEMENTS, MAX_TEXT_SIZE } from '../app';
import { commas, names, trunc } from '../library/factory';
import { community, nonthread } from '../library/listeners';
import { blame } from '../library/messages';
import { AnnounceRule, GraphRule, Script, ShowRule, SUIT_EMOJIS } from './deck';
import { uploadGraphFile } from './graphing';
import { getMembers } from './retrieving';
import { deckOf, evaluate, listify, matches, pluck, shuffle, validate } from './solving';

export const MAX_IMPORTS = 5;

export const events = (app: App): void => {
    const re_script = /^[`\s]*(\{.+\})[`\s]*$/s,
        re_url = /^\s*<([^|]+)(?:\|[^|]+)?>\s*$/;
    app.message(re_script, nonthread, community, async ({ message, context, client }) => {
        try {
            const suit = pluck(SUIT_EMOJIS);

            const script = <Script>JSON5.parse(context.matches[1]);
            if (script.import) {
                if (Array.isArray(script.import) && script.import.length > MAX_IMPORTS)
                    throw `Too many imports (limit of ${MAX_IMPORTS}) in script.`;

                try {
                    const imports = [];
                    for (let url of listify(script.import)) {
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

            const items = deckOf(script.deal, script),
                users = (await getMembers(message.channel, context, client))
                    .filter(user => user != message.user || !validate(script.moderator, script.options));

            const graph: ElementDefinition[] = [];
            if (script.rules && listify(script.rules).some(rule => 'graph' in rule)) {
                listify(script.rules).filter((rule): rule is GraphRule => 'graph' in rule && validate(rule.if ?? true, script.options)).forEach(rule => {
                    listify(rule.graph).forEach(node => {
                        items.filter(it => matches(it, node, script)).forEach(which => {
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

                listify(script.rules).filter((rule): rule is ShowRule => 'show' in rule && validate(rule.if ?? true, script.options)).forEach(rule => {
                    listify(rule.to).forEach(to => {
                        items.filter(it => matches(it, to, script)).forEach(yours => {
                            listify(rule.show).forEach(show => {
                                items.filter(it => matches(it, show, script)).forEach(theirs => {
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

            if (Object.keys(dealt).length == 0)
                throw 'You must deal at least 1 item.';

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

            let announced: string[] = [];
            if (script.rules) {
                listify(script.rules).filter((rule): rule is AnnounceRule => 'announce' in rule && validate(rule.if ?? true, script.options)).forEach(rule => {
                    listify(rule.announce).forEach(announce => {
                        Object.keys(dealt).forEach(who => {
                            dealt[who].filter(it => matches(it, announce, script)).forEach(whose => {
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

            const permalink = (await client.chat.getPermalink({
                channel: message.channel,
                message_ts: ts
            })).permalink;

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
                    listify(script.rules).filter((rule): rule is ShowRule => 'show' in rule && validate(rule.if ?? true, script.options)).forEach(rule => {
                        listify(rule.to).forEach(to => {
                            dealt[user].filter(it => matches(it, to, script)).forEach(yours => {
                                listify(rule.show).forEach(show => {
                                    Object.keys(dealt).forEach(them => {
                                        dealt[them].filter(it => matches(it, show, script)).forEach(theirs => {
                                            const text = trunc(`${!rule.as ? ':eye-in-speech-bubble:' : ':left_speech_bubble:'} Because you were dealt *${yours}* you see that ${them != user ? `<@${them}> was` : 'you were also'} dealt ${!rule.as ? `*${theirs}*` : `*${rule.as}* as an alias`}.`, MAX_TEXT_SIZE);
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

            await uploadGraphFile(
                `Graph: ${script.event ?? 'Event'}`,
                graph,
                script,
                message, context, client
            );
        }
        catch (err) {
            await blame(err, message, context, client);
        }
    });
};
