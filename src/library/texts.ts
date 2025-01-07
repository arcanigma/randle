
export function commas (list: (string | undefined)[], separator=', ', conjunction='and'): string {
    const flist = list.filter(it => it !== undefined);
    if (flist.length == 1)
        return flist[0];
    else if (flist.length == 2)
        return `${flist[0]} ${conjunction} ${flist[1]}`;
    else if (flist.length >= 3)
        return `${flist.slice(0, -1).join(separator)}, ${conjunction} ${flist.slice(-1)[0]}`;
    else
        return '';
}

export function size (object: Record<string, unknown>): number {
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

export function itemize (text: string): string[] {
    const elements = text.split(',').map(it => it.trim()).filter(Boolean);

    if (elements.length == 1) {
        const num = Number(elements[0]);
        if (num >= 1 && num % 1 == 0)
            return (Array(num).fill(1) as number[]).map((v, i) => String(v + i));
    }

    if (elements.length < 1)
        throw 'Number of items must be at least 1.';

    return elements;
}
