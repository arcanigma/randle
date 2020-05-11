const tokenize = (sentence, terminals) => {
    return sentence
        .trim()
        .split(terminals)
        .filter(it => it.trim())
        .filter(Boolean);
};

const expect = (tokens, terminal) => {
    if (tokens != [] && alike(tokens[0], terminal))
        return tokens.shift();
    else if (tokens == [] && terminal == null)
        return true;
    else if (tokens == [] && terminal != null)
        throw 'Unexpected end of input.';
    else
        throw `Unexpected \`${truncate(tokens.join(''), 15)}\` in input.`;
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

const truncate = (string, width) => {
    if (string.length <= width)
        return string;
    else
        return string.slice(0, width) + '...';
}

module.exports = {
    tokenize,
    expect,
    accept,
    peek
};
