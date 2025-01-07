import { randomInt } from 'crypto';
import { wss } from './texts.js';

export function listOf<T> (it: T | T[]): T[] {
    if (Array.isArray(it))
        return it.flat().filter(it => it !== undefined) as T[];
    else if (it !== undefined)
        return [it];
    else
        return [];
}

export function shuffleCopy<T> (list: T[]): T[] {
    const copy = [...list];
    return shuffleInPlace(copy);
}

export function shuffleInPlace<T> (list: T[]): T[] {
    for (let i = list.length - 1; i >= 1; i--) {
        const j = randomInt(0, i + 1);
        [ list[i], list[j] ] = [ list[j], list[i] ];
    }
    return list;
}

export function choose<T> (list: T[], quantity: number, fit = false): T[] {
    if (quantity > list.length) {
        if (fit)
            quantity = list.length;
        else
            throw `Choose \`${JSON.stringify(quantity)}\` too many for list \`${JSON.stringify(list)}\` in script.`;
    }

    if (quantity < 0)
        throw `Choose \`${JSON.stringify(quantity)}\` too few for list \`${JSON.stringify(list)}\` in script.`;

    if (list.length == 0)
        throw 'Choose for unexpected empty list in script.';

    return shuffleCopy(list).slice(list.length - quantity);
}

export function repeat<T> (list: T[], quantity: number): T[] {
    if (quantity < 0)
        throw `Repeat \`${JSON.stringify(quantity)}\` too few for list \`${JSON.stringify(list)}\` in script.`;

    if (list.length == 0)
        throw 'Repeat for unexpected empty list in script.';

    const build = [];
    for (let i = 1; i <= quantity; i++)
        build.push(list[randomInt(0, list.length)]);
    return build;
}

export function first<T> (list: T[], quantity: number, fit = false): T[] {
    if (quantity > list.length) {
        if (fit)
            quantity = list.length;
        else
            throw `First \`${JSON.stringify(quantity)}\` too many for list \`${JSON.stringify(list)}\` in script.`;
    }

    if (quantity < 0)
        throw `First \`${JSON.stringify(quantity)}\` too few for list \`${JSON.stringify(list)}\` in script.`;

    if (list.length == 0)
        throw 'First for unexpected empty list in script.';

    return list.slice(0, quantity);
}

export function last<T> (list: T[], quantity: number, fit = false): T[] {
    if (quantity > list.length) {
        if (fit)
            quantity = list.length;
        else
            throw `Last \`${JSON.stringify(quantity)}\` too many for list \`${JSON.stringify(list)}\` in script.`;
    }

    if (quantity < 0)
        throw `Last \`${JSON.stringify(quantity)}\` too few for list \`${JSON.stringify(list)}\` in script.`;

    if (list.length == 0)
        throw 'Last for unexpected empty list in script.';

    return list.slice(-quantity);
}

export function cross<T> (list1: T[], list2: T[], delimiter?: T): string[] {
    const build = [];
    for (const a of list1)
        for (const b of list2)
            build.push(`${String(a)}${delimiter ? String(delimiter) : ' \u2022 '}${String(b)}`);
    return shuffleCopy(build);
}

export function zip<T> (list1: T[], list2: T[], delimiter?: T): string[] {
    const build = [],
        a = shuffleCopy(list1),
        b = shuffleCopy(list2);
    while (a.length >= 1 && b.length >= 1)
        build.push(wss(`${String(a.shift())}${delimiter ? String(delimiter) : ' \u2022 '}${String(b.shift())}`));
    build.push(...a.map(String), ...b.map(String));
    return build;
}
