const randomInt = require('php-random-int');

const { who, commas, blame} = require('../plugins/factory.js'),
      { nonthread, anywhere, community } = require('../plugins/listen.js');

module.exports = (app) => {

    const re_shuffle = /^!?shuffle\s+(.+)/i;
    app.message(anywhere, re_shuffle, async ({ message, context, say }) => {
        try {
            let deck = parse_deck(context.matches[1]);

            await say({
                text: `${who(message, 'You')} shuffled *${deck.join('*, *')}*.`
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_draw = /^!?draw\s+(.+)/i;
    app.message(anywhere, re_draw, async ({ message, context, say }) => {
        try {
            let deck = parse_deck(context.matches[1]);

            await say({
                text: `${who(message, 'You')} drew *${deck.shift()}*.`
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    // TODO allow dealing "to" subset of channels or users
    // TODO parser for show portion
    const re_deal = /^!?deal\s+(.+?)(?:\s*&amp;\s*show\s+(.+?))?\s*$/is,
          re_show = /^([^:=]+)\s*:\s*([^:=]+?)(?:\s*=\s*([^:=]+))?$/;
    app.message(nonthread, community, re_deal, async ({ message, context, say }) => {
        try {
            let deck = parse_deck(context.matches[1]);

            let shows = {};
            if (context.matches[2]) {
                let phrases = lex(context.matches[2], /\s*,\s*/);
                for (let phrase of phrases) {
                    let [, source, target, alias] = phrase.trim().match(re_show) || [];

                    if (deck.includes(source) && deck.includes(target)) {
                        if (!shows[source])
                            shows[source] = [[target, alias]];
                        else
                            shows[source].push([target, alias]);
                    }
                    else if (!source || !target) {
                        return await say(blame('To show, you must list at least one `Source: Target` or `Source: Target=Alias` separated by commas.'))
                    }
                }
            }

            let uids = (await app.client.conversations.members({
                token: context.botToken,
                channel: message.channel
            })).members;

            let dealt = {};
            let held = {};
            for (let uid of uids) {
                let user = (await app.client.users.info({
                    token: context.botToken,
                    user: uid
                })).user;
                if (!user.is_bot) {
                    if (deck.length > 0) {
                        let item = deck.shift();

                        dealt[uid] = item;

                        if (!held[item])
                            held[item] = [uid];
                        else
                            held[item].push(uid);
                    }
                    else return await say(blame(`You must deal enough items for all users.`));
                }
            }

            for (let uid in dealt) {
                let item = dealt[uid];

                let per_summary = `${message.user != uid ? `<@${message.user}>` : 'You'} dealt ${message.user != uid ? 'you' : 'yourself'} *${item}* from <#${message.channel}>.`;

                let seen = [];
                if (shows[item])
                    for (let [target, alias] of shows[item]) {
                        if (held[target]) for (let tuid of held[target]) {
                            if (tuid != uid) seen.push({
                                type: 'mrkdwn',
                                text: `:eye-in-speech-bubble: You see <@${tuid}> was dealt *${alias ? alias : target}*.`
                            });
                        }
                    }

                let blocks = [{
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: per_summary
                    }
                }];
                if (seen.length > 0) {
                    shuffle(seen);
                    blocks.push({
                        type: 'context',
                        elements: seen
                    });
                }

                await app.client.chat.postMessage({
                    token: context.botToken,
                    channel: uid,
                    text: per_summary,
                    blocks: blocks
                });
            }

            let items = Object.keys(dealt).length;
            let targets = commas(Object.keys(dealt).map(u => u != message.user ? `<@${u}>` : 'themself'));
            let all_summary = `${who(message, 'You')} dealt *${items}* item${items != 1 ? 's' : ''} to ${targets} by direct message.`;

            let blocks = [{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: all_summary
                }
            }];
            if (deck.length > 0)
                blocks.push({
                    type: 'context',
                    elements: [{
                        type: 'mrkdwn',
                        text: `:warning: There ${deck.length != 1 ? 'were' : 'was'} *${deck.length}* item${deck.length != 1 ? 's' : ''} leftover.`
                    }]
                })

            await say({
                text: all_summary,
                blocks: blocks
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    function lex(expression, delims) {
        return expression.trim().split(delims).filter(it => it.trim()).filter(Boolean);
    }

    function expect(tokens, like) {
        if (tokens.length == 0 && like != null)
            throw new Error(`Unexpected end of input.`);
        else if (like instanceof RegExp ? tokens[0].match(like) : tokens[0] == like)
            return tokens.shift();
        else
            throw new Error(`Unexpected \`${tokens.join('')}\` in input.`);
    }

    function accept(tokens, like) {
        if (tokens.length == 0)
            return;
        else if (like instanceof RegExp ? tokens[0].match(like) : tokens[0] == like)
            return tokens.shift();
        else
            return false;
    }

    function peek(tokens, like) {
        if (tokens.length == 0)
            return;
        else if (like instanceof RegExp ? tokens[0].match(like) : tokens[0] == like)
            return tokens[0];
        else
            return false;
    }

    const re_lex_deck = /([(,):*])/;
    function parse_deck(text) {
        let tokens = lex(text, re_lex_deck);
        let deck = parse_list(tokens);
        expect(tokens, null);
        return deck;
    }

    function parse_list(tokens) {
        let list = [...parse_item(tokens)];
        while (accept(tokens, ',')) {
            list.push(...parse_item(tokens));
        }
        shuffle(list);
        return list;
    }

    const re_item = /[^(,)]+/,
          re_suffix = /[:*]/,
          re_integer = /[1-9][0-9]*/;
    function parse_item(tokens) {
        let item;
        if (accept(tokens, '(')) {
            item = parse_list(tokens);
            expect(tokens, ')');
        }
        else {
            item = [expect(tokens, re_item).trim()];
            while (peek(tokens, re_suffix)) {
                if (accept(tokens, ':')) {
                    let take = Math.min(parseInt(expect(tokens, re_integer)), item.length);

                    let build = [];
                    for (let i = 1; i <= take; i++) {
                        let r = randomInt(0, item.length-1);
                        [item[0], item[r]] = [item[r], item[0]];
                        build.push(item.shift());
                    }
                    item = build;
                }
                else if (accept(tokens, '*')) {
                    let take = parseInt(expect(tokens, re_integer));

                    let build = [];
                    for (let i = 1; i <= take; i++) {
                        build.push(item[randomInt(0, item.length-1)]);
                    }
                    item = build;
                }
            }

            return item;
        }
    }

    function shuffle(list) {
        for (let i = list.length-1; i >= 1; i--) {
            let j = randomInt(0, i);
            [list[i], list[j]] = [list[j], list[i]];
        }
    }
};
