const randomInt = require('php-random-int');

const { who, blame} = require('../plugins/factory.js');
const { anywhere, community } = require('../plugins/listen.js');

module.exports = (app) => {

    // TODO refactor using the !deal functionality
    const re_shuffle = /^!?shuffle\s+(.*)$/i;
    app.message(anywhere, re_shuffle, async ({ message, context, say }) => {
        try {
            let items = lex(context.matches[1]);
            if (items.length < 2)
                return await say(blame('You must list at least two items separated by commas.'));
            shuffle(items);

            await say({
                'text': `${who('You', message)} shuffled *${items.join('*, *')}*.`
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    // TODO refactor using the !deal functionality
    const re_draw = /^!?draw\s+(.*)$/i;
    app.message(anywhere, re_draw, async ({ message, context, say }) => {
        try {
            let items = lex(context.matches[1]);
            if (items.length < 2)
                return await say(blame('You must list at least two items separated by commas.'));
            shuffle(items);

            await say({
                'text': `${who('You', message)} drew *${items.shift()}*.`
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    // TODO allow dealing "to" subset of channels or users
    const re_deal = /^!?deal\s+(.+?)(?:\s*&amp;\s*show\s+(.+?))?\s*$/is;
    app.message(community, re_deal, async ({ message, context, say }) => {
        try {
            const re_boundaries = /([(,):*])/;
            let tokens = lex(context.matches[1], re_boundaries);

            let deck
            try {
                deck = parse_list(tokens);
                expect(tokens, null);
            }
            catch (err) {
                return await say(blame(err.message, message));
            }

            let shows = {};
            if (context.matches[2]) {
                let phrases = lex(context.matches[2]);
                for (phrase of phrases) {
                    const re_reveal = /^([^:=]+)\s*:\s*([^:=]+?)(?:\s*=\s*([^:=]+))?$/;
                    let [, source, target, alias] = phrase.trim().match(re_reveal) || [];

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
            for (uid of uids) {
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

            for (uid in dealt) {
                let item = dealt[uid];

                let per_summary = `${who('You', message, uid)} dealt ${who('yourself', message, uid)} *${item}* from <#${message.channel}>.`;

                let seen = [];
                if (shows[item]) for ([target, alias] of shows[item]) {
                    if (held[target]) for (tuid of held[target]) {
                        if (tuid != uid) seen.push({
                            'type': 'mrkdwn',
                            'text': `:eye-in-speech-bubble: You see <@${tuid}> was dealt *${alias ? alias : target}*.`
                        });
                    }
                }

                let blocks = [{
                    'type': 'section',
                    'text': {
                        'type': 'mrkdwn',
                        'text': per_summary
                    }
                }];
                if (seen.length > 0) {
                    shuffle(seen);
                    blocks.push({
                        'type': 'context',
                        'elements': seen
                    });
                }

                await app.client.chat.postMessage({
                    token: context.botToken,
                    channel: uid,
                    'text': per_summary,
                    'blocks': blocks
                });
            }

            dealt = Object.keys(dealt);

            let all_summary = `${who('You', message)} dealt *${dealt.length}* item${dealt.length != 1 ? 's' : ''} to <@${dealt.join('>, <@')}> by direct message.`;

            let blocks = [{
                'type': 'section',
                'text': {
                    'type': 'mrkdwn',
                    'text': all_summary
                }
            }];
            if (deck.length > 0)
                blocks.push({
                    'type': 'context',
                    'elements': [{
                        'type': 'mrkdwn',
                        'text': `:warning: There ${deck.length != 1 ? 'were' : 'was'} *${deck.length}* item${deck.length != 1 ? 's' : ''} leftover.`
                    }]
                })

            await say({
                'text': all_summary,
                'blocks': blocks
            });
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_commas = /\s*,\s*/;
    function lex(expression, on=re_commas) {
        return expression.trim().split(on).filter(it => it.trim()).filter(Boolean);
    }

    /* FISHER YATES SHUFFLE */
    function shuffle(list) {
        for (let i = list.length-1; i >= 1; i--) {
            let j = randomInt(0, i);
            [list[i], list[j]] = [list[j], list[i]];
        }
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

    function parse_list(tokens) {
        let list = [...parse_item(tokens)];
        while (accept(tokens, ',')) {
            list.push(...parse_item(tokens));
        }
        shuffle(list);
        return list;
    }

    function parse_item(tokens) {
        let item;
        if (accept(tokens, '(')) {
            item = parse_list(tokens);
            expect(tokens, ')');
        }
        else {
            const re_normal = /[^(,)]+/;
            item = [expect(tokens, re_normal).trim()];
        }

        const re_suffix = /[:*]/,
              re_integer = /[1-9][0-9]*/;
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
};
