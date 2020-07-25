import { MessageEvent } from '@slack/bolt';

// TODO ensure consistency across application
export function who(message: MessageEvent, pronoun: string): string {
    return message.channel_type != 'im' ? `<@${message.user}>` : pronoun;
}

export function commas(list: string[], separator=', ', conjunction='and'): string {
    if (list.length == 1)
        return list[0];
    else if (list.length == 2)
        return `${list[0]} ${conjunction} ${list[1]}`;
    else if (list.length >= 3)
        return `${list.slice(0, -1).join(separator)}, ${conjunction} ${list.slice(-1)}`;
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
