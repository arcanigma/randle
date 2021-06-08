import { GuildMember } from 'discord.js';

export function commas (list: (string | undefined)[], separator=', ', conjunction='and'): string {
    const flist = <string[]>list.filter(it => it !== undefined);
    if (flist.length == 1)
        return flist[0];
    else if (flist.length == 2)
        return `${flist[0]} ${conjunction} ${flist[1]}`;
    else if (flist.length >= 3)
        return `${flist.slice(0, -1).join(separator)}, ${conjunction} ${flist.slice(-1)[0]}`;
    else
        return '';
}

export function names (members: GuildMember[], separator?: string, conjunction?: string): string {
    return commas(members.map(them => `${them.toString()}`), separator, conjunction) || 'nobody';
}

export function size (object: {[key: string]: unknown}): number {
    return Object.keys(object).length;
}

export function trunc (text: string, limit: number): string {
    if (text === undefined)
        return 'undefined';
    else if (text.length <= limit)
        return text;
    else
        return text.substring(0, limit-3) + '...';
}

const re_wss = /\s+/g;
export function wss (text: string): string {
    return text.trim().replace(re_wss, ' ');
}
