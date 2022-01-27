export type Script = {
    event?: string;
    requireModerator?: Option;
    minMembers?: Value;
    maxMembers?: Value;
    setup?: Setup;
    rules?: Rule[];
    import?: string | string[];
};

type Name = string;

export type Setup = {
    [name: Name]: Value | Option | Deck;
};

export type Value =
    | Name | 'members'
    | number
    | { plus: Value[] }
    | { minus: Value[] }
    | { times: Value[] }
    | { max: Value[] }
    | { min: Value[] }

export type Option =
    | Name
    | boolean
    | { and: Option[] }
    | { or: Option[] }
    | { not: Option }

export type Deck =
    | Name
    | string
    // TODO image URL or other media item
    | { choose: Value; from: Deck }
    | { choose: Value; grouping: Deck[] }
    | { repeat: Value; from: Deck }
    | { repeat: Value; grouping: Deck[] }
    | { duplicate: Value; of?: Value; from: Deck }
    | { first: Value; from: Deck }
    | { last: Value; from: Deck }
    | { cross: Deck; with: Deck; using?: string }
    | { zip: Deck; with: Deck; using?: string }
    | { if: Option; then: Deck; else?: Deck }
    | { union: Deck }
    | { intersect: Deck }
    | { except: Deck }
    | Deck[]

export type Rule = (
    | DealRule
    | ShowRule
    | AnnounceRule
    | ExplainRule
) & ConditionalRule

export type DealRule = {
    deal: Deck;
    for?: string;
    limit?: Value;
}

export type ShowRule = {
    show: Matcher;
    to: Matcher;
    hideSame?: Option;
    as?: string;
    limit?: Value;
    cumulative?: Option;
}

export type AnnounceRule = {
    announce: Matcher;
    as?: string;
    limit?: Value;
    cumulative?: Option;
}

export type ExplainRule = {
    explain: string;
    as: string;
    cumulative?: Option;
}

export type ConditionalRule = {
    if?: Option;
    when?: Matcher;
}

export type Matcher =
    | string
    | { includes: string }
    | { excludes: string }
    | { startsWith: string }
    | { startsWithout: string }
    | { endsWith: string }
    | { endsWithout: string }
    | { is: string }
    | { isNot: string }
    | { pattern: string }
    | { all: true }
    | { not: Matcher }
    | Deck
    // TODO matcher for member dealt order
    | Matcher[]
