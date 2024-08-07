import { randomInt } from 'crypto';
import { wss } from './factory.js';
import { Deck, Matcher, Option, Rule, Setup, Value } from './script.js';

export function deckOf (it?: Deck, setup?: Setup): string[] {
    if (it === undefined)
        return [];
    else if (Array.isArray(it)) {
        return it.map(item => deckOf(item, setup)).flat();
    }
    else if (typeof it === 'string') {
        if (setup?.[it] !== undefined)
            return setup[it] = deckOf(
                setup[it] as Deck,
                Object.assign({}, setup, { [it]: undefined })
            );
        else if (setup !== undefined && Object.keys(setup).includes(it))
            throw `Recursive deck \`${JSON.stringify(it)}\` in script.`;
        else
            return [wss(it)];
    }
    else if ('choose' in it && 'from' in it)
        return choose(deckOf(it.from, setup), valueOf(it.choose, setup));
    else if ('choose' in it && 'grouping' in it)
        return deckOf(choose(it.grouping, valueOf(it.choose, setup)), setup);
    else if ('repeat' in it && 'from' in it)
        return repeat(deckOf(it.from, setup), valueOf(it.repeat, setup));
    else if ('repeat' in it && 'grouping' in it)
        return deckOf(repeat(it.grouping, valueOf(it.repeat, setup)), setup);
    else if ('duplicate' in it)
        return repeat(
            choose(deckOf(it.from, setup), it.of ? valueOf(it.of, setup) : 1),
            valueOf(it.duplicate, setup)
        );
    else if ('first' in it)
        return first(deckOf(it.from, setup), valueOf(it.first, setup));
    else if ('last' in it)
        return last(deckOf(it.from, setup), valueOf(it.last, setup));
    else if ('cross' in it)
        return cross(deckOf(it.cross, setup), deckOf(it.with, setup), it.using);
    else if ('zip' in it)
        return zip(deckOf(it.zip, setup), deckOf(it.with, setup), it.using);
    else if ('if' in it)
        return optionOf(it.if, setup)
            ? deckOf(it.then, setup)
            : it.else
                ? deckOf(it.else, setup)
                : [] ;
    // TODO show rule for given set name requires degenerate union/intersect/except
    else if ('union' in it) {
        return listOf(it.union).reduce((x, y) => [ ...deckOf(x, setup), ...deckOf(y, setup) ].filter((item, index, self) => self.indexOf(item) === index)) as string[];
    }
    else if ('intersect' in it) {
        return listOf(it.intersect).reduce((x, y) => deckOf(x, setup).filter(item => deckOf(y, setup).includes(item))) as string[];
    }
    else if ('except' in it) {
        return listOf(it.except).reduce((x, y) => deckOf(x, setup).filter(item => !deckOf(y, setup).includes(item))) as string[];
    }
    else
        throw `Unexpected deck \`${JSON.stringify(it)}\` in script.`;
}

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

export function valueOf (it?: Value, setup?: Setup): number {
    if (it === undefined)
        return 0;
    if (typeof it === 'number')
        return it;
    else if (typeof it === 'string') {
        if (setup?.[it] !== undefined)
            return setup[it] = valueOf(
                setup[it] as Value,
                Object.assign({}, setup, { [it]: undefined })
            );
        else if (setup !== undefined && Object.keys(setup).includes(it))
            throw `Recursive value \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined value \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('plus' in it)
        return it.plus.reduce((x, y) => valueOf(x, setup) + valueOf(y, setup)) as number;
    else if ('minus' in it)
        return it.minus.reduce((x, y) => valueOf(x, setup) - valueOf(y, setup)) as number;
    else if ('times' in it)
        return it.times.reduce((x, y) => valueOf(x, setup) * valueOf(y, setup)) as number;
    else if ('max' in it)
        return Math.max(...it.max.map(x => valueOf(x, setup)));
    else if ('min' in it)
        return Math.min(...it.min.map(x => valueOf(x, setup)));
    else
        throw `Unexpected value \`${JSON.stringify(it)}\` in script.`;
}

export function optionOf (it?: Option, setup?: Setup): boolean {
    if (it === undefined || it === false || it === 'false')
        return false;
    else if (it === true || it === 'true')
        return true;
    else if (typeof it === 'string') {
        if (setup?.[it] !== undefined)
            return setup[it] = optionOf(
                setup[it] as Option,
                Object.assign({}, setup, { [it]: undefined })
            );
        else if (setup !== undefined && Object.keys(setup).includes(it))
            throw `Recursive option \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined option \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('and' in it)
        return it.and.every(opt => optionOf(opt, setup));
    else if ('or' in it)
        return it.or.some(opt => optionOf(opt, setup));
    else if ('not' in it)
        return !optionOf(it.not, setup);
    else
        throw `Unexpected option \`${JSON.stringify(it)}\` in script.`;
}

export function conditionOf (rule: Rule, used: string[], setup?: Setup): boolean {
    if ('if' in rule && rule.if !== undefined)
        if (!optionOf(rule.if, setup))
            return false;

    if ('when' in rule && rule.when !== undefined)
        if (!used.some(it => matchOf(it, rule.when as Matcher, setup)))
            return false;

    return true;
}

export function matchOf (it: string, matcher: Matcher, setup?: Setup): boolean {
    if (Array.isArray(matcher))
        return matcher.some(m => matchOf(it, m, setup));
    else if (typeof matcher === 'string')
        if (setup?.[it] !== undefined)
            return matchOf(it, deckOf(matcher, setup), setup);
        else
            return matchOf(it, { includes: matcher }, setup);
    else if ('includes' in matcher)
        return it.includes(wss(matcher.includes));
    else if ('excludes' in matcher)
        return !it.includes(wss(matcher.excludes));
    else if ('startsWith' in matcher)
        return it.startsWith(wss(matcher.startsWith));
    else if ('startsWithout' in matcher)
        return !it.startsWith(wss(matcher.startsWithout));
    else if ('endsWith' in matcher)
        return it.endsWith(wss(matcher.endsWith));
    else if ('endsWithout' in matcher)
        return !it.endsWith(wss(matcher.endsWithout));
    else if ('is' in matcher)
        return it == wss(matcher.is);
    else if ('isNot' in matcher)
        return it != wss(matcher.isNot);
    else if ('pattern' in matcher)
        return new RegExp(wss(matcher.pattern)).exec(it) != null;
    else if ('all' in matcher)
        return true;
    else if ('not' in matcher)
        return !matchOf(it, matcher.not, setup);
    else {
        try {
            return matchOf(it, deckOf(matcher, setup), setup);
        }
        catch (error) {
            throw `Unexpected matcher \`${JSON.stringify(matcher)}\` in script.`;
        }
    }
}
