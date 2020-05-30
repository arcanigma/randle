const randomInt = require('php-random-int');

const { who, commas, names, blame } = require('../plugins/factory.js'),
      { tokenize, expect, accept } = require('../plugins/parser.js'),
      { nonthread, anywhere, community } = require('../plugins/listen.js');

module.exports = (app) => {

    const re_shuffle = /^!?shuffle\s+(.+)/is;
    app.message(nonthread, anywhere, re_shuffle, async ({ message, context, say }) => {
        try {
            let items = parse_deck(context.matches[1]);

            await say({
                text: `${who(message, 'You')} shuffled ${commas(items.map(item => `*${item}*`))}.`
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_draw = /^!?draw\s+(?:([1-9][0-9]*)\s+from\s+)?(.+)/is;
    app.message(nonthread, anywhere, re_draw, async ({ message, context, say }) => {
        try {
            let items = parse_deck(`(${context.matches[2]}):${context.matches[1] || 1}`);

            await say({
                text: `${who(message, 'You')} drew ${commas(items.map(item => `*${item}*`))}.`
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_deal = /^([!?])?deal\s+(.+)/is,
          re_braces = /\{.+\}/s,
          re_wss = /\s+/g;
    app.message(nonthread, community, re_deal, async ({ message, context, say, client }) => {
        try {
            let dry_run = context.matches[1] == '?';

            let setup, items;
            if (re_braces.test(context.matches[2])) {
                try {
                    setup = JSON.parse(context.matches[2].replace(re_wss, ' '));
                }
                catch (error) {
                    throw error.message;
                }
                items = build_deck(setup.items);
            }
            else {
                setup = {
                    items: context.matches[2]
                };
                items = parse_deck(setup.items);
            }

            let users = shuffle((await client.conversations.members({
                token: context.botToken,
                channel: message.channel
            })).members.filter(user => user != context.botUserId));

            let dealt = {};
            do {
                users.forEach(user => {
                    if (items.length > 0) {
                        if (dealt[user])
                            dealt[user].push(items.shift());
                        else
                            dealt[user] = [items.shift()];
                    }
                });
            } while (items.length > 0);

            let counts = {};
            users.forEach(user => {
                let count = dealt[user].length;
                if (!counts[count])
                    counts[count] = [user];
                else
                    counts[count].push(user);
            });

            Object.keys(dealt).forEach(async (us) => {
                let per_list = commas(dealt[us].map(item => `*${item}*`)),
                    per_venue = setup.event ? `for the *${setup.event}* event` : `from the <#${message.channel}> channel`,
                    per_summary = `:twisted_rightwards_arrows: ${message.user != us ? `<@${message.user}>` : 'You'} dealt ${message.user != us ? 'you' : 'yourself'} ${per_list} ${per_venue}<!date^${Math.trunc(message.ts)}^ {date_short_pretty} at {time}| recently>.`,
                    per_blocks = [{
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: per_summary
                        }
                    }];

                let shown = [];
                (setup.rules || []).filter(rule => rule.show).forEach(rule => {
                    listize(rule.to).filter(to => dealt[us].includes(to)).forEach(to => {
                        listize(rule.show).forEach(show => {
                            Object.keys(dealt).filter(them => them != us && dealt[them].includes(show)).forEach(them => {
                                shown.push({
                                    type: 'mrkdwn',
                                    text: `:eye-in-speech-bubble: Because you were dealt *${to}* you see that <@${them}> was dealt *${rule.as ? rule.as : show}*.`
                                });
                            });
                        });
                    });
                });
                if (shown.length > 0) {
                  per_blocks.push({
                      type: 'context',
                      elements: shuffle(shown)
                  });
                }

                if (!dry_run)
                    await client.chat.postMessage({
                        token: context.botToken,
                        channel: us,
                        text: per_summary,
                        blocks: per_blocks
                    });
            });

            let all_list = commas(Object.keys(counts).sort().reverse().map(count => {
                    return `${count > 0 ? `*${count}* each` : '*none*'} to ${names(counts[count])}`;
                }), '; '),
                all_summary = `${who(message, 'You')} dealt ${all_list} by direct message.`,
                all_blocks = [{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: all_summary
                    }
                }];

            if (!dry_run)
                await client.chat.postMessage({
                    token: context.botToken,
                    channel: message.channel,
                    text: all_summary,
                    blocks: all_blocks
                });
            else
                await client.chat.postEphemeral({
                    token: context.botToken,
                    channel: message.channel,
                    user: message.user,
                    text: 'Your `deal` script is valid.'
                });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    function build_deck(list) {
        return shuffle(unnest_deck(list).flat());
    }

    function unnest_deck(list) {
        return listize(list).map(element => {
            if (typeof element == 'string') {
                return element.trim().replace(re_wss, ' ');
            }
            else if (typeof element == 'object' && !Array.isArray(element)) {
                let items = unnest_deck(element.from);
                if (element.choose)
                    return choose(items, element.choose);
                else if (element.repeat)
                    return repeat(items, element.repeat);
            }
            throw `Unsupported \`${element}\` item.`;
        });
    }

    const re_terminals = /([(,):*])/;
    function parse_deck(text) {
        let tokens = tokenize(text, re_terminals),
            deck = parse_list(tokens);
        expect(tokens, null);
        return shuffle(deck);
    }

    function parse_list(tokens) {
        let items = [];
        do {
            items.push(...parse_element(tokens));
        } while(accept(tokens, ','));
        return items;
    }

    const re_nonterminals = /[^(,):*]+/;
    function parse_element(tokens) {
        let items;
        if (accept(tokens, '(')) {
            items = parse_list(tokens);
            expect(tokens, ')');
        }
        else {
            let element = expect(tokens, re_nonterminals);
            items = [element.trim().replace(re_wss, ' ')];
        }
        return parse_quantifier(tokens, items);
    }

    const re_integer = /[1-9][0-9]*/;
    function parse_quantifier(tokens, items) {
        if (accept(tokens, ':')) {
            let quantity = parseInt(expect(tokens, re_integer));
            items = choose(items, quantity);
            return parse_quantifier(tokens, items);
        }
        else if (accept(tokens, '*')) {
            let quantity = parseInt(expect(tokens, re_integer));
            items = repeat(items, quantity);
            return parse_quantifier(tokens, items);
        }
        return items;
    }

    function listize(element) {
        return Array.of(element).flat();
    }

    function shuffle(items) {
        let copy = listize(items);
        for (let i = copy.length-1; i >= 1; i--) {
            let j = randomInt(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function choose(items, quantity) {
        let copy = shuffle(items);
        return copy.slice(items.length - quantity);
    }

    function repeat(items, quantity) {
        let build = [];
        for (let i = 1; i <= quantity; i++)
            build.push(items[randomInt(0, items.length-1)]);
        return build;
    }
};
