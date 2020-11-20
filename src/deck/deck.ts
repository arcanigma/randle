import { App } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import * as commands from './commands';
import * as scripts from './scripts';

export const SUIT_EMOJIS: {
    [suit: string]: string;
} = {
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

export type Defines = {
    sets?: SetDefines;
    values?: ValueDefines;
    options?: OptionDefines;
}

export type SetDefines = { [name: string]: Set }

export type ValueDefines = { [name: string]: Value }

export type OptionDefines = { [name: string]: Option }

export type Set =
    | string[]
    | string
    | { union: Set[] }
    | { intersect: Set[] }
    | { except: Set[] }

export type Value =
    | number
    | string
    | { plus: Value[] }
    | { minus: Value[] }
    | { times: Value[] }
    | { max: Value[] }
    | { min: Value[] }

export type Option =
    | boolean
    | string
    | { and: Option[] }
    | { or: Option[] }
    | { not: Option }

export type Items =
    | string
    | { choose: Value; from: Items }
    | { choose: Value; grouping: Items[] }
    | { repeat: Value; from: Items }
    | { repeat: Value; grouping: Items[] }
    | { duplicate: Value; of?: Value; from: Items }
    | { cross: Items; with: Items; using?: string }
    | { zip: Items; with: Items; using?: string }
    | { if: Option; then: Items; else?: Items }
    | { set: Set; union?: Set; intersect?: Set; except?: Set }
    | Items[]

export type Rules =
    | ShowRule
    | AnnounceRule
    | GraphRule
    | ExplainRule
    | RelayRule
    | Rules[]

export type ShowRule = {
    show: Matcher;
    to: Matcher;
    as?: string;
    loopless?: Option;
} & Conditional

export type AnnounceRule = {
    announce: Matcher;
    as?: string;
} & Conditional

export type GraphRule = {
    graph: Matcher;
    color: string;
} & Conditional

export type ExplainRule = {
    explain: string;
    emoji?: string;
} & Conditional

export type RelayRule = {
    relay: RelayService;
    for: Matcher;
    as?: string;
    numbered?: Option;
} & Conditional

export type RelayService = {
    service: 'wordnik';
    parts?: string[];
    length?: number;
    corpus?: number;
    dictionary?: number;
    limit?: number;
};

export type Conditional = {
    if?: Option;
    ifIncluded?: string | string[];
    ifExcluded?: string | string[];
}

export type Matcher =
    | string
    | { is: string }
    | { isNot: string }
    | { startsWith: string }
    | { startsWithout: string }
    | { endsWith: string }
    | { endsWithout: string }
    | { includes: string }
    | { excludes: string }
    | { matches: string }
    | { all: true }
    | { set: Set; union?: Set; intersect?: Set; except?: Set }
    | Matcher[]

export const register = ({ app, store }: { app: App; store: Promise<MongoClient> }): void => {
    [ commands, scripts ].forEach(it => {
        it.register({ app, store });
    });
};
