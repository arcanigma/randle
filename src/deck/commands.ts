import { App, BlockAction, MultiStaticSelectAction } from '@slack/bolt';
import { Block, MultiSelect, SectionBlock } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import ordinal from 'ordinal';
import { MAX_TEXT_SIZE } from '../app';
import { commas, trunc, wss } from '../library/factory';
import { anywhere, nonthread } from '../library/listeners';
import { blame } from '../library/messages';
import { postDeckMessage } from './posting';
import { choose, repeat, shuffle } from './solving';

export const MODE_WORD: ({
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

export const events = (app: App, store: Promise<MongoClient>): void => {
    const re_shuffle = /^!?shuffle\s+(.+)/is;
    app.message(re_shuffle, nonthread, anywhere, async ({ message, context, client, say }) => {
        try {
            await postDeckMessage(
                'Shuffle',
                context.matches[1],
                items => shuffle(items),
                0,
                message, context, client, say, store
            );
        }
        catch (err) {
            await blame(err, message, context, client);
        }
    });

    const re_draw = /^!?draw\s+(?:([1-9][0-9]*)\s+(?:from|of)\s+)?(.+)/is;
    app.message(re_draw, nonthread, anywhere, async ({ message, context, client, say }) => {
        try {
            await postDeckMessage(
                'Draw',
                context.matches[2],
                items => choose(items, context.matches[1] ?? 1),
                0,
                message, context, client, say, store
            );
        }
        catch (err) {
            await blame(err, message, context, client);
        }
    });

    const re_pool = /^!?pool\s+(?:([1-9][0-9]*)\s+(?:(?:from|of|in)\s+)?)?(.+)/is;
    app.message(re_pool, nonthread, anywhere, async ({ message, context, client, say }) => {
        try {
            await postDeckMessage(
                'Pool', // TODO evidentiary version
                context.matches[2],
                items => repeat(items, context.matches[1] ?? 1),
                0,
                message, context, client, say, store
            );
        }
        catch (err) {
            await blame(err, message, context, client);
        }
    });

    const re_action_id = /^deck_message_select_(\w+)_(\d+)_(\[[^\]]+\])$/,
        re_block_id = /^deck_message_block_(U\w+)_(\[[^\]]+\])$/;
    app.action<BlockAction<MultiStaticSelectAction>>(re_action_id, async ({ ack, body, action, context, say, respond }) => {
        await ack();

        const user = body.user.id,
            selected = action.selected_options
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

            const message = body.message!;

            await respond({
                replace_original: true,
                text: message.text!,
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
                token: context.botToken,
                channel: body.channel!.id,
                thread_ts: body.message!.ts,
                text: message.text!,
                blocks: history
            });
        }
        else throw `Unsupported mode \`${mode}\` on redo.`;
    });
};
