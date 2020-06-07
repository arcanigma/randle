import { MessageEvent, SayArguments } from '@slack/bolt';
import { SectionBlock, ContextBlock } from '@slack/web-api';

import { MAX_TEXT_SIZE } from '../app.js';

export function who(message: MessageEvent, pronoun: string): string {
    return message.channel_type != 'im' ? `<@${message.user}>` : pronoun;
}

export function commas(list: string[], separator=', '): string {
    if (list.length == 1)
        return list[0];
    else if (list.length == 2)
        return `${list[0]} and ${list[1]}`;
    else if (list.length >= 3)
        return `${list.slice(0, -1).join(separator)}, and ${list.slice(-1)}`;
    else
        return '';
}

export function names(list: string[], user?: string, separator=', '): string {
    return commas(
        list.sort(u => u == user ? -1 : 0)
            .map(u => u != user ? `<@${u}>` : 'you'),
        separator
    ) || 'nobody';
}

export function size(object: {[key: string]: unknown}): number {
    return Object.keys(object).length;
}

export function trunc(text: string, limit: number): string {
    if (text.length <= limit)
        return text;
    else
        return text.substring(0, limit-2) + '...';
}

const re_wss = /\s+/g;
export function wss(text: string): string {
    return text.trim().replace(re_wss, ' ');
}

export function boxbar(count: number, total: number): string {
    const squares = Math.round(count / total * total);
    return onbox(squares) + offbox(total - squares);
}

export function onbox(count: number): string {
    return '\uD83D\uDD33'.repeat(count);
}

export function offbox(count: number): string {
    return '\u2B1C'.repeat(count);
}

export function blame(error: string | Error, message: MessageEvent): SayArguments {
    console.log({ error });
    if (error instanceof Error) {
        return {
            text: 'There was an error',
            blocks: [
                <SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'plain_text',
                        text: 'Your message caused an error. Please report these details to the developer.'
                    }
                },
                <ContextBlock>{
                    type: 'context',
                    elements: [
                        {
                          type: 'mrkdwn',
                          text: `:octagonal_sign: *${error.name}:* ${trunc(error.message, MAX_TEXT_SIZE)}`
                        },
                        {
                          type: 'mrkdwn',
                          text: `*Location:* ${error.stack?.match(/\w+.ts:\d+:\d+/g)?.[0] ?? 'unknown'}`
                        },
                        {
                          type: 'mrkdwn',
                          text: `*Context:* ${message.channel_type}-${message.channel}`
                        },
                        {
                          type: 'mrkdwn',
                          text: `*Text:* ${trunc(message.text ?? 'undefined', MAX_TEXT_SIZE)}`
                        }
                    ]
                }
            ]
        };
    }
    else {
        return {
            text: 'There was an error',
            blocks: [
                <SectionBlock>{
                    type: 'section',
                    text: {
                        type: 'plain_text',
                        text: 'Your command has a problem. Please correct the problem before trying again.'
                    }
                },
                <ContextBlock>{
                    type: 'context',
                    elements: [
                        {
                          type: 'mrkdwn',
                          text: `:warning: *User Error:* ${trunc(error, MAX_TEXT_SIZE)}`
                        }
                    ]
                }
            ]
        };
    }
}
