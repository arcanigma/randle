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
    deal?: Deck;
    rules?: Rules;
    import?: string | string[];
} & Defines;
export type Defines = {
    sets?: Sets;
    values?: Values;
    options?: Options;
}

export type Sets = { [name: string]: Set; }
export type Set =
    | string[] // TODO support nested Deck
    | string
// | { union: Set[]; }
// | { intersect: Set[]; }
// | { except: Set[]; }

export type Values = { [name: string]: Value; }
export type Value =
    | number
    | string
    | { plus: Value[]; }
    | { minus: Value[]; }
    | { times: Value[]; }
    | { max: Value[]; }
    | { min: Value[]; }

export type Options = { [name: string]: Option; }
export type Option =
    | boolean
    | string
    | { and: Option[]; }
    | { or: Option[]; }
    | { not: Option; }

export type Deck =
    | string
    | { choose: Value; from: Deck; }
    | { choose: Value; grouping: Deck[]; }
    | { repeat: Value; from: Deck; }
    | { repeat: Value; grouping: Deck[]; }
    | { duplicate: Value; of?: Value; from: Deck; }
    | { cross: Deck; with: Deck; using?: string; }
    | { zip: Deck; with: Deck; using?: string; }
    | { set: Set; }
    | { if: Option; then: Deck; else?: Deck; }
    | Deck[]

export type Rules = Rule | Rule[];
export type Rule = (
    | ShowRule
    | AnnounceRule
    | GraphRule
) & Conditional
export type ShowRule = { show: Matchers; to: Matchers; as?: string; }
export type AnnounceRule = { announce: Matchers; as?: string; }
export type GraphRule = { graph: Matchers; color: string; }
export type Conditional = { if?: Option; }

export type Matchers = Matcher | Matcher[];
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
    | { set: string }
    | { all: true }

export const events = (app: App, store: Promise<MongoClient>): void => {
    commands.events(app, store);
    scripts.events(app);
};
