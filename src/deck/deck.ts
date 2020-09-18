import { App } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import * as commands from './commands';
import * as scripts from './scripts';

export const SUIT_EMOJIS: ({
    [suit: string]: string
}) = {
    'Spades': ':spades:',
    'Hearts': ':hearts:',
    'Clubs': ':clubs:',
    'Diamonds': ':diamonds:',
    'Stars': ':star:'
};

export type Script = {
    event?: string;
    moderator?: Option;
    limit?: Value;
    deal?: Items;
    rules?: Rules;
    import?: string | string[];
} & Defines;

export type Defines = { // TODO unify these types?
    sets?: SetDefines;
    values?: ValueDefines;
    options?: OptionDefines;
}

export type SetDefines = { [name: string]: Set; }

export type ValueDefines = { [name: string]: Value; }

export type OptionDefines = { [name: string]: Option; }

export type Set =
    | string[]
    | string
    | { union: Set[]; }
    | { intersect: Set[]; }
    | { except: Set[]; }
    // TODO support nested Items

export type Value =
    | number
    | string
    | { plus: Value[]; }
    | { minus: Value[]; }
    | { times: Value[]; }
    | { max: Value[]; }
    | { min: Value[]; }

export type Option =
    | boolean
    | string
    | { and: Option[]; }
    | { or: Option[]; }
    | { not: Option; }

export type Items =
    | string
    | { choose: Value; from: Items; }
    | { choose: Value; grouping: Items[]; }
    | { repeat: Value; from: Items; }
    | { repeat: Value; grouping: Items[]; }
    | { duplicate: Value; of?: Value; from: Items; }
    | { cross: Items; with: Items; using?: string; }
    | { zip: Items; with: Items; using?: string; }
    | { if: Option; then: Items; else?: Items; }
    | { set: Set; }
    | Items[]

export type Rules =
    | ShowRule
    | AnnounceRule
    | GraphRule
    | Rules[]

export type ShowRule = {
    show: Matcher;
    to: Matcher;
    as?: string;
    loopless?: Option; // TODO all-encompassing loopless/no-self option
} & Conditional

export type AnnounceRule = {
    announce: Matcher;
    as?: string;
} & Conditional

export type GraphRule = {
    graph: Matcher;
    color: string;
} & Conditional

export type Conditional = { if?: Option; }

export type Matcher =
    | string
    | { is: string; }
    | { isNot: string; }
    | { startsWith: string; }
    | { startsWithout: string; }
    | { endsWith: string; }
    | { endsWithout: string; }
    | { includes: string; }
    | { excludes: string; }
    | { matches: string; }
    | { all: true }
    | { set: Set; }
    | Matcher[]

export const events = (app: App, store: Promise<MongoClient>): void => {
    commands.events(app, store);
    scripts.events(app);
};
