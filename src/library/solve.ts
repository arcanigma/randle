import { randomInt } from 'crypto';
import { wss } from './factory';
import { Defines, Items, Matcher, Option, OptionDefines, Rules, Set, SetDefines, Value, ValueDefines } from './script';

export function build (items: Items, defines: Defines): string[] {
    if (Array.isArray(items))
        return items.map(
            item => build(item, defines)
        ).flat();
    else if (typeof items === 'string')
        return [wss(items)];
    else if ('choose' in items) {
        if ('from' in items)
            return choose(
                build(items.from, defines),
                evaluate(items.choose, defines.values)
            );
        else if ('grouping' in items)
            return build(choose(
                items.grouping,
                evaluate(items.choose, defines.values)
            ), defines);
        else
            throw `Unexpected choose \`${JSON.stringify(items)}\` in script.`;
    }
    else if ('repeat' in items) {
        if ('from' in items)
            return repeat(
                build(items.from, defines),
                evaluate(items.repeat, defines.values)
            );
        else if ('grouping' in items)
            return build(repeat(
                items.grouping,
                evaluate(items.repeat, defines.values)
            ), defines);
        else
            throw `Unexpected repeat \`${JSON.stringify(items)}\` in script.`;
    }
    else if ('duplicate' in items)
        return repeat(
            choose(
                build(items.from, defines),
                items.of ? evaluate(items.of, defines.values) : 1
            ),
            evaluate(items.duplicate, defines.values)
        );
    else if ('cross' in items)
        return cross(
            build(items.cross, defines),
            build(items.with, defines),
            items.using
        );
    else if ('zip' in items)
        return zip(
            build(items.zip, defines),
            build(items.with, defines),
            items.using
        );
    else if ('if' in items)
        return validate(items.if, defines.options)
            ? build(items.then, defines)
            : items.else ? build(items.else, defines) : [] ;
    else if ('set' in items || 'union' in items) {
        let result = [
            ...construct(items.set, defines.sets),
            ...construct(items.union, defines.sets)
        ];

        if ('intersect' in items) {
            const intersect = construct(items.intersect, defines.sets);
            result = result.filter(it => intersect.includes(it));
        }

        if ('except' in items) {
            const except = construct(items.except, defines.sets);
            result = result.filter(it => !except.includes(it));
        }

        return result;
    }
    else
        throw `Unexpected deck \`${JSON.stringify(items)}\` in script.`;
}

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

export function evaluate (it: Value | undefined, values?: ValueDefines): number {
    if (it === undefined)
        return 0;
    if (typeof it === 'number')
        return it;
    else if (typeof it === 'string') {
        if (values?.[it] !== undefined)
            return values[it] = evaluate(
                values[it],
                Object.assign({}, values, { [it]: undefined })
            );
        else if (values !== undefined && Object.keys(values).includes(it))
            throw `Recursive value \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined value \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('plus' in it)
        return <number>it.plus.reduce((x, y) => evaluate(x, values) + evaluate(y, values));
    else if ('minus' in it)
        return <number>it.minus.reduce((x, y) => evaluate(x, values) - evaluate(y, values));
    else if ('times' in it)
        return <number>it.times.reduce((x, y) => evaluate(x, values) * evaluate(y, values));
    else if ('max' in it)
        return Math.max(...it.max.map(x => evaluate(x, values)));
    else if ('min' in it)
        return Math.min(...it.min.map(x => evaluate(x, values)));
    else
        throw `Unexpected value \`${JSON.stringify(it)}\` in script.`;
}

export function validate (it: Option | undefined, options?: OptionDefines): boolean {
    if (it === undefined)
        return false;
    if (typeof it === 'boolean')
        return it;
    else if (typeof it === 'string') {
        if (options?.[it] !== undefined)
            return options[it] = validate(
                options[it],
                Object.assign({}, options, { [it]: undefined })
            );
        else if (options !== undefined && Object.keys(options).includes(it))
            throw `Recursive option \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined option \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('and' in it)
        return it.and.every(opt => validate(opt, options));
    else if ('or' in it)
        return it.or.some(opt => validate(opt, options));
    else if ('not' in it)
        return !validate(it.not, options);
    else
        throw `Unexpected option \`${JSON.stringify(it)}\` in script.`;
}

export function enable (rule: Rules, items: string[], options?: OptionDefines): boolean {
    if ('if' in rule && rule.if !== undefined)
        if (!validate(rule.if, options))
            return false;

    if ('ifIncluded' in rule && rule.ifIncluded !== undefined)
        if (!listify(rule.ifIncluded).every(it => items.includes(it)))
            return false;

    if ('ifExcluded' in rule && rule.ifExcluded !== undefined)
        if (listify(rule.ifExcluded).every(it => items.includes(it)))
            return false;

    return true;
}

export function construct (it: Set | undefined, sets?: SetDefines): string[] {
    if (Array.isArray(it))
        return it;
    else if (it === undefined)
        return [];
    else if (typeof it === 'string') {
        if (sets?.[it] !== undefined)
            return sets[it] = construct(
                sets[it],
                Object.assign({}, sets, { [it]: undefined })
            );
        else if (sets !== undefined && Object.keys(sets).includes(it))
            throw `Recursive set \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined set \`${JSON.stringify(it)}\` in script.`;
    }
    else if ('union' in it)
        return <string[]>it.union.reduce((x, y) => [ ...construct(x, sets), ...construct(y, sets) ].filter((item, index, self) => self.indexOf(item) === index));
    else if ('intersect' in it)
        return <string[]>it.intersect.reduce((x, y) => construct(x, sets).filter(item => construct(y, sets).includes(item)));
    else if ('except' in it)
        return <string[]>it.except.reduce((x, y) => construct(x, sets).filter(item => !construct(y, sets).includes(item)));
    else
        throw `Unexpected set \`${JSON.stringify(it)}\` in script.`;
}

export function matches (it: string, matcher: Matcher, defines: Defines): boolean {
    if (Array.isArray(matcher))
        return matcher.some(m => matches(it, m, defines));
    else if (typeof matcher === 'string')
        return matches(it, { 'includes': matcher }, defines);
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
    else if ('all' in matcher && matcher.all === true)
        return true;
    else if ('set' in matcher) {
        let result =
            matches(it, construct(matcher.set, defines.sets), defines) ||
            matches(it, construct(matcher.union, defines.sets), defines);

        if ('intersect' in matcher)
            result = result && matches(it, construct(matcher.intersect, defines.sets), defines);

        if ('except' in matcher)
            result = result && !matches(it, construct(matcher.except, defines.sets), defines);

        return result;
    }
    else
        throw `Unexpected matcher \`${JSON.stringify(matcher)}\` in script.`;
}
