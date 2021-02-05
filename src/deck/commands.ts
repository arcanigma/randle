import { App, BlockAction, Context, GenericMessageEvent, MultiStaticSelectAction, SayFn } from '@slack/bolt';
import { Block, MultiSelect, SectionBlock, WebClient } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import ordinal from 'ordinal';
import { MAX_TEXT_SIZE } from '../app';
import { commas, trunc, wss } from '../library/factory';
import { anywhere, nonthread } from '../library/listeners';
import { getMembers } from '../library/lookup';
import { blame } from '../library/messages';
import { getMacro } from '../macros/macros';
import { SUIT_EMOJIS } from './deck';
import { choose, pluck, repeat, shuffleInPlace } from './solving';

export const MODE_WORD: {
    [mode: string]: {
        did: string;
        redo: string;
        redid: string;
    };
} = {
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
    'Pool': { // TODO hashed macro pools
        did: 'Pooled',
        redo: 'Repool',
        redid: 'Repooled'
    }
};

export const register = ({ app, store }: { app: App; store: Promise<MongoClient> }): void => {
    const re_shuffle = /^!?shuffle\s+(.+)/is;
    app.message(re_shuffle, nonthread, anywhere, async ({ message, context, client, say }) => {
        try {
            await postDeckMessage({
                mode: 'Shuffle',
                expression: (<string[]> context.matches)[1],
                fun: items => shuffleInPlace(items),
                recount: 0,
                message: message as GenericMessageEvent,
                context,
                client,
                say
            });
        }
        catch (error) {
            await blame({ error: <string|Error> error, message, context, client });
        }
    });

    const re_draw = /^!?draw\s+(?:([1-9][0-9]*)\s+(?:from|of)\s+)?(.+)/is;
    app.message(re_draw, nonthread, anywhere, async ({ message, context, client, say }) => {
        try {
            await postDeckMessage({
                mode: 'Draw',
                expression: (<string[]> context.matches)[2],
                fun: items => choose(items, parseInt((<string[]> context.matches)[1]) || 1),
                recount: 0,
                message: message as GenericMessageEvent,
                context,
                client,
                say
            });
        }
        catch (error) {
            await blame({ error: <string|Error> error, message, context, client });
        }
    });

    const re_pool = /^!?pool\s+(?:([1-9][0-9]*)\s+(?:(?:from|of|in)\s+)?)?(.+)/is;
    app.message(re_pool, nonthread, anywhere, async ({ message, context, client, say }) => {
        try {
            await postDeckMessage({
                mode: 'Pool',
                expression: (<string[]> context.matches)[2],
                fun: items => repeat(items, parseInt((<string[]> context.matches)[1]) || 1),
                recount: 0,
                message: message as GenericMessageEvent,
                context,
                client,
                say
            });
        }
        catch (error) {
            await blame({ error: <string|Error> error, message, context, client });
        }
    });

    const re_macro = /^[\w_][\w\d_]{2,14}$/;
    async function postDeckMessage ( { mode, expression, fun, recount, message, context, client, say }:
        { mode: string; expression: string; fun: (list: string[]) => string[]; recount: number; message: GenericMessageEvent; context: Context; client: WebClient; say: SayFn }
    ): Promise<void> {
        const user = message.user,
            suit = pluck(SUIT_EMOJIS);

        let list = expression.split(',').map(it => it.trim());
        if (list.length == 1) {
            if (Number(list[0]) >= 1 && Number(list[0]) % 1 == 0)
                list = (<number[]> Array(Number(list[0])).fill(1)).map((v, i) => String(v + i));
            else if (list[0] == '<!channel>')
                list = (await getMembers(message.channel, context, client)).map(them => `<@${them}>`);
            else if (re_macro.test(list[0]))
                list = (await getMacro({ store, context, user, name: list[0] })).split(',').map(it => it.trim());
        }

        const items = fun(list);

        await say({
            token: <string> context.botToken,
            channel: message.channel,
            username: `${mode}: ${suit}`,
            icon_emoji: SUIT_EMOJIS[suit],
            text: `<@${user}> ${MODE_WORD[mode].did.toLowerCase()} ${list.length != 1 ? 'items' : 'an item'}`,
            blocks: [
                <SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(`<@${user}> ${MODE_WORD[mode].did.toLowerCase()} ${commas(items.map(item => `*${wss(item)}*`))}.`, MAX_TEXT_SIZE)
                    }
                },
                ...mode == 'Pool' ? [
                    <SectionBlock>{
                        type: 'section',
                        block_id: `deck_message_block_${user}_${JSON.stringify(list)}`,
                        text: {
                            type: 'mrkdwn',
                            text: ':left_speech_bubble: Original Results'
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
                                    text: trunc(`${ordinal(index+1)} \u2022 ${item}`, 75)
                                },
                                value: `${index}`
                            }))
                        }
                    }
                ] : []
            ]
        });
    }

    const re_action_id = /^deck_message_select_(\w+)_(\d+)_(\[[^\]]+\])$/,
        re_block_id = /^deck_message_block_(U\w+)_(\[[^\]]+\])$/;
    app.action<BlockAction<MultiStaticSelectAction>>(re_action_id, async ({ ack, body, action, context, say, respond }) => {
        await ack();

        const user = body.user.id,
            selected = action.selected_options
                .map(it => Number(it.value)).sort(),
            [ , mode, str_recount, json_items ] = re_action_id.exec(action.action_id) ?? [],
            [ , whom, json_list ] = re_block_id.exec(action.block_id) ?? [],
            recount = Number(str_recount),
            list = <string[]>JSON.parse(json_list),
            items = (<number[]>JSON.parse(json_items)).map(index => list[index]);

        if (user != whom)
            return void respond({
                replace_original: false,
                response_type: 'ephemeral',
                text: `That ${mode.toLowerCase()} belongs to <@${whom}>.`
            });

        if (mode == 'Pool') {
            const history: Block[] = [];

            if (recount == 1)
                history.push(<SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: trunc(`Original \u2022 ${commas(Array.of(...items).map(item => `*${wss(item)}*`))}.`, MAX_TEXT_SIZE)
                    }
                });

            selected.forEach(index => {
                items[index] = repeat(list, 1)[0];
            });

            history.push(<SectionBlock>{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: trunc(`${MODE_WORD[mode].redo} *${recount}* \u2022 ${commas(items.map((item, index) => `*${wss(selected.includes(index) ? `(${item})` : item)}*`))}.`, MAX_TEXT_SIZE)
                }
            });

            const message = body.message as GenericMessageEvent;

            await respond({
                replace_original: true,
                text: message.text,
                blocks: [
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
                            text: `:eye-in-speech-bubble: ${MODE_WORD[mode].redid} *${recount}* Time${recount != 1 ? 's' : ''}`
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
                                    text: trunc(`${ordinal(index+1)} \u2022 ${item}`, 75)
                                },
                                value: `${index}`
                            }))
                        }
                    }
                ]
            });

            await say({
                token: <string> context.botToken,
                channel: (<{ id: string }> body.channel).id,
                thread_ts: message.ts,
                text: <string> message.text,
                blocks: history
            });
        }
        else throw `Unsupported mode \`${mode}\` on redo.`;
    });
};
