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

export function names (list: string[], separator?: string, conjunction?: string): string {
    return commas(list.map(u => `<@${u}>`), separator, conjunction) || 'nobody';
}

export function size (object: {[key: string]: unknown}): number {
    return Object.keys(object).length;
}

export function trunc (text: string, limit: number): string {
    if (text.length <= limit)
        return text;
    else
        return text.substring(0, limit-3) + '...';
}

export function fallback_date (ts: string): string {
    const date = new Date(parseInt(ts) * 1000);
    return `${date.toDateString()} at ${date.toLocaleTimeString()}`;
}

const re_wss = /\s+/g;
export function wss (text: string): string {
    return text.trim().replace(re_wss, ' ');
}

export function boxbar (count: number, total: number): string {
    const squares = Math.round(count / total * total);
    return onbox(squares) + offbox(total - squares);
}

export function onbox (count: number): string {
    return '\uD83D\uDD33'.repeat(count);
}

export function offbox (count: number): string {
    return '\u2B1C'.repeat(count);
}
