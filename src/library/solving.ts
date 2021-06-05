import { randomInt } from 'crypto';
import { wss } from '../library/factory';

// TODO scripting functions

export function listify<T> (element: T | T[]): T[] {
    if (Array.isArray(element))
        return element.flat().filter(it => it !== undefined) as T[];
    else if (element !== undefined)
        return [element];
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

export function choose<T> (list: T[], quantity: number): T[] {
    if (quantity > list.length || quantity < 0)
        throw `Unexpected choose quantity \`${JSON.stringify(quantity)}\` for list \`${JSON.stringify(list)}\` in script.`;

    return shuffleCopy(list).slice(list.length - quantity);
}

export function repeat<T> (list: T[], quantity: number): T[] {
    if (quantity < 0)
        throw `Unexpected repeat quantity \`${JSON.stringify(quantity)}\` for list \`${JSON.stringify(list)}\` in script.`;

    if (list.length == 0)
        throw 'Unexpected empty list in script.';

    const build = [];
    for (let i = 1; i <= quantity; i++)
        build.push(list[randomInt(0, list.length)]);
    return build;
}

export function pluck (object: Record<string, unknown>): string {
    return choose(Object.keys(object), 1)[0];
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
