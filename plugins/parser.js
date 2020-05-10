const tokenize = (sentence, terminals) => {
    return sentence
        .trim()
        .split(terminals)
        .filter(it => it.trim())
        .filter(Boolean)
        .map(String);
};

const expect = (tokens, terminal) => {
    if (tokens != [] && alike(tokens[0], terminal))
        return tokens.shift();
    else if (tokens == [] && terminal == null)
        return true;
    else if (tokens == [] && terminal != null)
        throw new Error('Unexpected end of input.');
    else
        throw new Error(`Unexpected \`${tokens.join('')}\` in input.`);
};

const accept = (tokens, terminal) => {
    if (tokens != [] && alike(tokens[0], terminal))
        return tokens.shift();
    else
        return false;
};

const peek = (tokens, terminal) => {
    if (tokens != [] && alike(tokens[0], terminal))
        return tokens[0];
    else
        return false;
};

const alike = (token, terminal) => {
    if (terminal instanceof RegExp)
        return terminal.test(token);
    else
        return token == terminal;
}

module.exports = {
    tokenize,
    expect,
    accept,
    peek
};
