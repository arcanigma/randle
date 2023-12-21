import { trunc } from './factory.js';

export function tokenize (sentence: string, separator: string | RegExp): string[] {
    return sentence
        .trim()
        .split(separator)
        .filter(token => token.trim())
        .filter(Boolean);
}

export function expect (tokens: string[], terminal: string | RegExp): string {
    if (tokens.length > 0 && alike(tokens[0], terminal))
        return <string> tokens.shift();
    else if (tokens.length == 0)
        throw 'Unexpected end of input.';
    else
        throw `Unexpected \`${trunc(tokens.join(''), 15)}\` in input.`;
}

export function expectEnd (tokens: string[]): void {
    if (tokens.length != 0)
        throw `Expected end before \`${trunc(tokens.join(''), 15)}\` in input.`;
}

export function accept (tokens: string[], terminal: string | RegExp): string | boolean {
    if (tokens.length > 0 && alike(tokens[0], terminal))
        return <string> tokens.shift();
    else
        return false;
}

export function peek (tokens: string[], terminal: string | RegExp): string | boolean {
    if (tokens.length > 0 && alike(tokens[0], terminal))
        return tokens[0];
    else
        return false;
}

export function alike (token: string, terminal: string | RegExp): boolean {
    return terminal instanceof RegExp
        ? terminal.test(token)
        : token == terminal;
}
