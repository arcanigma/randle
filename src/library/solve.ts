import { randomInt } from 'crypto';
import { wss } from './factory';
import { Items, Matcher, Option, Parameters, Rules, Set, Value } from './script';

// TODO use vm2 to sandbox scripts using these functions

export function build (items: Items, params?: Parameters): string[] {
    if (Array.isArray(items))
        return items.map(
            item => build(item, params)
        ).flat();
    else if (typeof items === 'string')
        return [wss(items)];
    else if ('choose' in items) {
        if ('from' in items)
            return choose(
                build(items.from, params),
                valueOf(items.choose, params)
            );
        else if ('grouping' in items)
            return build(choose(
                items.grouping,
                valueOf(items.choose, params)
            ), params);
        else
            throw `Unexpected choose \`${JSON.stringify(items)}\` in script.`;
    }
    else if ('repeat' in items) {
        if ('from' in items)
            return repeat(
                build(items.from, params),
                valueOf(items.repeat, params)
            );
        else if ('grouping' in items)
            return build(repeat(
                items.grouping,
                valueOf(items.repeat, params)
            ), params);
        else
            throw `Unexpected repeat \`${JSON.stringify(items)}\` in script.`;
    }
    else if ('duplicate' in items)
        return repeat(
            choose(
                build(items.from, params),
                items.of ? valueOf(items.of, params) : 1
            ),
            valueOf(items.duplicate, params)
        );
    else if ('cross' in items)
        return cross(
            build(items.cross, params),
            build(items.with, params),
            items.using
        );
    else if ('zip' in items)
        return zip(
            build(items.zip, params),
            build(items.with, params),
            items.using
        );
    else if ('if' in items)
        return optionOf(items.if, params)
            ? build(items.then, params)
            : items.else ? build(items.else, params) : [] ;
    else if ('set' in items || 'union' in items) {
        let result = [
            ...setOf(items.set, params),
            ...setOf(items.union, params)
        ];

        if ('intersect' in items) {
            const intersect = setOf(items.intersect, params);
            result = result.filter(it => intersect.includes(it));
        }

        if ('except' in items) {
            const except = setOf(items.except, params);
            result = result.filter(it => !except.includes(it));
        }

        return result;
    }
    else
        throw `Unexpected deck \`${JSON.stringify(items)}\` in script.`;
}

export function listOf<T> (element: T | T[]): T[] {
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

export function choose<T> (list: T[], quantity: number, fit = false): T[] {
    if ((quantity > list.length && !fit) || quantity < 0)
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

export function valueOf (it?: Value, params?: Parameters): number {
    if (it === undefined)
        return 0;
    if (typeof it === 'number')
        return it;
    else if (typeof it === 'string') {
        if (params?.[it] !== undefined && params[it])
            return params[it] = valueOf(
                params[it] as Value,
                Object.assign({}, params, { [it]: undefined })
            );
        else if (params !== undefined && Object.keys(params).includes(it))
            throw `Recursive value \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined value \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('plus' in it)
        return <number>it.plus.reduce((x, y) => valueOf(x, params) + valueOf(y, params));
    else if ('minus' in it)
        return <number>it.minus.reduce((x, y) => valueOf(x, params) - valueOf(y, params));
    else if ('times' in it)
        return <number>it.times.reduce((x, y) => valueOf(x, params) * valueOf(y, params));
    else if ('max' in it)
        return Math.max(...it.max.map(x => valueOf(x, params)));
    else if ('min' in it)
        return Math.min(...it.min.map(x => valueOf(x, params)));
    else
        throw `Unexpected value \`${JSON.stringify(it)}\` in script.`;
}

export function optionOf (it?: Option, params?: Parameters): boolean {
    if (it === undefined)
        return false;
    if (typeof it === 'boolean')
        return it;
    else if (typeof it === 'string') {
        if (params?.[it] !== undefined)
            return params[it] = optionOf(
                params[it] as Option,
                Object.assign({}, params, { [it]: undefined })
            );
        else if (params !== undefined && Object.keys(params).includes(it))
            throw `Recursive option \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined option \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('and' in it)
        return it.and.every(opt => optionOf(opt, params));
    else if ('or' in it)
        return it.or.some(opt => optionOf(opt, params));
    else if ('not' in it)
        return !optionOf(it.not, params);
    else
        throw `Unexpected option \`${JSON.stringify(it)}\` in script.`;
}

export function setOf (it?: Set, params?: Parameters): string[] {
    if (Array.isArray(it))
        return it;
    else if (it === undefined)
        return [];
    else if (typeof it === 'string') {
        if (params?.[it] !== undefined)
            return params[it] = setOf(
                params[it] as Set,
                Object.assign({}, params, { [it]: undefined })
            );
        else if (params !== undefined && Object.keys(params).includes(it))
            throw `Recursive set \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined set \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('union' in it)
        return <string[]>it.union.reduce((x, y) => [ ...setOf(x, params), ...setOf(y, params) ].filter((item, index, self) => self.indexOf(item) === index));
    else if ('intersect' in it)
        return <string[]>it.intersect.reduce((x, y) => setOf(x, params).filter(item => setOf(y, params).includes(item)));
    else if ('except' in it)
        return <string[]>it.except.reduce((x, y) => setOf(x, params).filter(item => !setOf(y, params).includes(item)));
    else
        throw `Unexpected set \`${JSON.stringify(it)}\` in script.`;
}

// TODO move to run
export function conditional (rule: Rules, items: string[], params?: Parameters): boolean {
    if ('if' in rule && rule.if !== undefined)
        if (!optionOf(rule.if, params))
            return false;

    if ('whenDealt' in rule && rule.whenDealt !== undefined)
        if (!items.some(it => matches(it, rule.whenDealt as Matcher, params)))
            return false;

    return true;
}

export function matches (it: string, matcher: Matcher, params?: Parameters): boolean {
    if (Array.isArray(matcher))
        return matcher.some(m => matches(it, m, params));
    else if (typeof matcher === 'string')
        return matches(it, { 'includes': matcher }, params);
    else if ('is' in matcher)
        return it == wss(matcher.is);
    if ('isNot' in matcher)
        return it != wss(matcher.isNot);
    else if ('startsWith' in matcher)
        return it.startsWith(wss(matcher.startsWith));
    else if ('startsWithout' in matcher)
        return !it.startsWith(wss(matcher.startsWithout));
    else if ('endsWith' in matcher)
        return it.endsWith(wss(matcher.endsWith));
    else if ('endsWithout' in matcher)
        return !it.endsWith(wss(matcher.endsWithout));
    else if ('includes' in matcher)
        return it.includes(wss(matcher.includes));
    else if ('excludes' in matcher)
        return !it.includes(wss(matcher.excludes));
    else if ('matches' in matcher)
        return new RegExp(wss(matcher.matches)).exec(it) != null;
    else if ('all' in matcher)
        return optionOf(matcher.all, params);
    else if ('not' in matcher)
        return !matches(it, matcher.not, params);
    else if ('set' in matcher) {
        let result =
            matches(it, setOf(matcher.set, params), params) ||
            matches(it, setOf(matcher.union, params), params);

        if ('intersect' in matcher)
            result = result && matches(it, setOf(matcher.intersect, params), params);

        if ('except' in matcher)
            result = result && !matches(it, setOf(matcher.except, params), params);

        return result;
    }
    else
        throw `Unexpected matcher \`${JSON.stringify(matcher)}\` in script.`;
}
