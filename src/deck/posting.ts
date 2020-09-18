import { Context, MessageEvent, SayFn } from '@slack/bolt';
import { MultiSelect, SectionBlock, WebClient } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import ordinal from 'ordinal';
import { MAX_TEXT_SIZE } from '../app';
import { commas, trunc, wss } from '../library/factory';
import { getMembers } from '../library/lookup';
import { getMacro } from '../macros/macros';
import { MODE_WORD } from './commands';
import { SUIT_EMOJIS } from './deck';
import { pluck } from './solving';

// TODO refactor to support initial posts
// TODO refactor back into scripts

const re_macro = /^[\w_][\w\d_]{2,14}$/;
export async function postDeckMessage(
    mode: string,
    expression: string,
    fun: (list: string[]) => string[],
    recount: number,
    message: MessageEvent,
    context: Context,
    client: WebClient,
    say: SayFn,
    store: Promise<MongoClient>
): Promise<void> {
    const user = message.user,
        suit = pluck(SUIT_EMOJIS);

    let list = <string[]>expression.split(',').map(it => it.trim());
    if (list.length == 1) {
        if (Number(list[0]) >= 1 && Number(list[0]) % 1 == 0)
            list = Array(Number(list[0])).fill(1).map((v, i) => String(v + i));
        else if (list[0] == '<!channel>')
            list = (await getMembers(message.channel, context, client)).map(them => `<@${them}>`);
        else if (re_macro.test(list[0]))
            list = (await getMacro(store, context, user, list[0])).split(',').map(it => it.trim());
    }

    const items = fun(list);

    await say({
        token: context.botToken,
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
            ...(mode == 'Pool' ? [
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
            ] : [])
        ]
    });
}
