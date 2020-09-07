import randomInt from 'php-random-int';
import { wss } from '../library/factory';
import { Deck, Defines, Matcher, Option, Options, Set, Sets, Value, Values } from './deck.js';

export function deckOf(items: Deck, defines: Defines): string[] {
    return shuffle(subdeckOf(items, defines));
}

export function subdeckOf(items: Deck, defines: Defines): string[] {
    if (typeof items === 'string')
        return [wss(items)];
    else if ('choose' in items) {
        if ('from' in items)
            return choose(
                subdeckOf(items.from, defines),
                evaluate(items.choose, defines.values)
            );
        else if ('grouping' in items)
            return subdeckOf(choose(
                items.grouping,
                evaluate(items.choose, defines.values)
            ), defines);
        else
            throw `Unexpected choose \`${JSON.stringify(items)}\` in script.`;
    }
    else if ('repeat' in items) {
        if ('from' in items)
            return repeat(
                subdeckOf(items.from, defines),
                evaluate(items.repeat, defines.values)
            );
        else if ('grouping' in items)
            return subdeckOf(repeat(
                items.grouping,
                evaluate(items.repeat, defines.values)
            ), defines);
        else
            throw `Unexpected repeat \`${JSON.stringify(items)}\` in script.`;
    }
    else if ('duplicate' in items)
        return repeat(
            choose(
                subdeckOf(items.from, defines),
                items.of ? evaluate(items.of, defines.values) : 1
            ),
            evaluate(items.duplicate, defines.values)
        );
    else if ('cross' in items)
        return cross(
            subdeckOf(items.cross, defines),
            subdeckOf(items.with, defines),
            items.using
        );
    else if ('zip' in items)
        return zip(
            subdeckOf(items.zip, defines),
            subdeckOf(items.with, defines),
            items.using
        );
    else if ('if' in items)
        return validate(items.if, defines.options)
            ? subdeckOf(items.then, defines)
            : ( items.else ? subdeckOf(items.else, defines) : [] );
    else if ('set' in items) {
        return construct(items.set, defines.sets);
    }
    else if (Array.isArray(items))
        return items.map(
            item => subdeckOf(item, defines)
        ).flat();
    else
        throw `Unexpected deck \'${JSON.stringify(items)}\` in script.`;
}

export function listify<T>(element: T | T[]): T[] {
    if (element === undefined)
        return [];
    else if (Array.isArray(element))
        return element.flat() as T[];
    else
        return [element];
}

export function shuffle<T>(list: T[]): T[] {
    const copy = [...list];
    for (let i = copy.length - 1; i >= 1; i--) {
        const j = randomInt(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function choose<T>(list: T[], quantity: number): T[] {
    if (quantity > list.length || quantity < 0)
        throw `Unexpected choose quantity \`${JSON.stringify(quantity)}\` for list \`${JSON.stringify(list)}\` in script.`;

    return shuffle(list).slice(list.length - quantity);
}

export function repeat<T>(list: T[], quantity: number): T[] {
    if (quantity < 0)
        throw `Unexpected repeat quantity \`${JSON.stringify(quantity)}\` for list \`${JSON.stringify(list)}\` in script.`;

    if (list.length == 0)
        throw 'Unexpected empty list in script.';

    const build = [];
    for (let i = 1; i <= quantity; i++)
        build.push(list[randomInt(0, list.length - 1)]);
    return build;
}

export function pluck(object: Record<string, unknown>): string {
    return choose(Object.keys(object), 1)[0];
}

export function cross<T>(list1: T[], list2: T[], delimiter?: T): string[] {
    const build = [];
    for (let i = 0; i < list1.length; i++)
        for (let j = 0; j < list2.length; j++)
            build.push(`${list1[i]}${delimiter ?? ' \u2022 '}${list2[j]}`);
    return shuffle(build);
}

export function zip<T>(list1: T[], list2: T[], delimiter?: T): string[] {
    const build = [],
        copy1 = shuffle(list1),
        copy2 = shuffle(list2);
    for (let i = 0; i < Math.min(list1.length, list2.length); i++)
        build.push(wss(`${copy1[i]}${delimiter ?? ' \u2022 '}${copy2[i]}`));
    return build;
}

export function evaluate(it: Value | undefined, values?: Values): number {
    if (it === undefined)
        return 0;
    if (typeof it === 'number')
        return it;
    else if (typeof it === 'string') {
        if (values !== undefined && values[it] !== undefined)
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
        throw `Unexpected value \'${JSON.stringify(it)}\` in script.`;
}

export function validate(it: Option | undefined, options?: Options): boolean {
    if (it === undefined)
        return false;
    if (typeof it === 'boolean')
        return it;
    else if (typeof it === 'string') {
        if (options !== undefined && options[it] !== undefined)
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
        throw `Unexpected option \'${JSON.stringify(it)}\` in script.`;
}

export function construct(it: Set | undefined, sets?: Sets): string[] {
    if (it === undefined)
        return [];
    if (Array.isArray(it))
        return it;
    else if (typeof it === 'string') {
        if (sets !== undefined && sets[it] !== undefined)
            return sets[it] = construct(
                sets[it],
                Object.assign({}, sets, { [it]: undefined })
            );
        else if (sets !== undefined && Object.keys(sets).includes(it))
            throw `Recursive set \`${JSON.stringify(it)}\` in script.`;
        else
            throw `Undefined set \`${JSON.stringify(it)}\` in script.`;
    }
    // else if ('union' in it)
    //     return <string[]>it.union.reduce((x, y) => [...construct(x, sets), ...construct(y, sets)].filter((item, index, self) => self.indexOf(item) === index));
    // else if ('intersect' in it)
    //     return <string[]>it.intersect.reduce((x, y) => construct(x, sets).filter(item => construct(y, sets).includes(item)));
    // else if ('except' in it)
    //     return <string[]>it.except.reduce((x, y) => construct(x, sets).filter(item => !construct(y, sets).includes(item)));
    else
        throw `Unexpected set \'${JSON.stringify(it)}\` in script.`;
}

export function matches(it: string, matcher: Matcher, defines: Defines): boolean {
    if (typeof matcher === 'string')
        return it == wss(matcher);
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
        return it.match(wss(matcher.matches)) != null;
    else if ('set' in matcher)
        return construct(matcher.set, defines.sets).includes(it);
    else if ('all' in matcher && matcher.all === true)
        return true;
    else
        throw `Unexpected matcher \'${JSON.stringify(matcher)}\` in script.`;
}
