export type Script = {
    event?: string;
    requireModerator?: boolean;
    minMembers?: number;
    maxMembers?: number;
    limit?: number;
    parameters?: Parameters;
    // TODO unify Sets/Items into named Decks with deals from each
    dealFirst?: Items;
    deal?: Items;
    dealLast?: Items;
    rules?: Rules;
    import?: string | string[];
};

type Name = string;

export type Parameters = {
    // TODO decouple Sets into Decks
    [name: Name]: Value | Option | Set;
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

export type Set =
    | Name
    | string[]
    | { union: Set[] }
    | { intersect: Set[] }
    | { except: Set[] }

export type Items =
    | string
    // TODO image URL or other media item
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
    | ExplainRule
    | Rules[]

export type ShowRule = {
    show: Matcher;
    to: Matcher;
    as?: string;
    limit?: Value;
    hideSame?: Option;
} & Conditional

export type AnnounceRule = {
    announce: Matcher;
    as?: string;
    limit?: Value;
} & Conditional

export type ExplainRule = {
    explain: string;
    as: string;
} & Conditional

export type Conditional = {
    if?: Option;
    whenDealt?: Matcher;
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
    | { all: Option }
    | { not: Matcher }
    | { set: Set; union?: Set; intersect?: Set; except?: Set }
    // TODO matcher for member dealt order
    | Matcher[]
