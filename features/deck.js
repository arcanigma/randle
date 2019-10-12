const CONFIG = require('../config'),
      randomInt = require('php-random-int');

module.exports = function(controller) {

    controller.hears(/^!?shuffle\s+(.*)$/i, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            let items = lex(message.matches[1]);
            if (items.length < 2)
                await controller.plugins.handler.raise('You must list at least two items separated by commas.');
            shuffle(items);

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            await bot.reply(message, {
                'text': `${who} shuffled *${items.join('*, *')}*.`
            });
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    controller.hears(/^!?draw\s+(.*)$/i, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            let items = lex(message.matches[1]);
            if (items.length < 2)
                await controller.plugins.handler.raise('You must list at least two items separated by commas.');
            shuffle(items);

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            await bot.reply(message, {
                'text': `${who} drew *${items.shift()}*.`
            });
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    controller.hears(/^!?deal\s+(.+?)(?:\s*&amp;\s*show\s+(.+?))?\s*$/is, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            let tokens = lex(message.matches[1], /([(,):*])/);

            let deck = parse_list(tokens);
            if (tokens.length > 0)
                await controller.plugins.handler.raise(`Unexpected \`${tokens[0].trim()}\` at \`${tokens.join(' ').replace(/\s+/g, ' ').trim()}\`.`)

            let shows = {};
            if (message.matches[2]) {
                let phrases = lex(message.matches[2]);
                for (phrase of phrases) {
                    const reveal = /^([^:=]+)\s*:\s*([^:=]+?)(?:\s*=\s*([^:=]+))?$/;
                    let [, source, target, alias] = phrase.trim().match(reveal) || [];

                    if (deck.includes(source) && deck.includes(target)) {
                        if (!shows[source])
                            shows[source] = [[target, alias]];
                        else
                            shows[source].push([target, alias]);
                    }
                    else if (!source || !target) {
                        await controller.plugins.handler.raise('To show, you must list at least one `Source: Target` or `Source: Target=Alias` separated by commas.')
                    }
                }
            }
            console.log(shows);

            let uids = (await bot.api.conversations.members({channel: message.channel})).members;

            let dealt = {};
            let held = {};
            for (uid of uids) {
                let user = (await bot.api.users.info({user: uid})).user;
                if (!user.is_bot) {
                    if (deck.length > 0) {
                        let item = deck.shift();

                        dealt[uid] = item;

                        if (!held[item])
                            held[item] = [uid];
                        else
                            held[item].push(uid);
                    }
                    else await controller.plugins.handler.raise(`You must deal enough items for all users.`)
                }
            }

            for (uid in dealt) {
                let item = dealt[uid];

                let summary = `${uid != message.user ? `<@${message.user}>` : 'You'} dealt ${uid != message.user ? 'you' : 'yourself'} *${item}* from <#${message.channel}>.`;

                let details = [];
                if (shows[item]) for ([target, alias] of shows[item]) {
                    if (held[target]) for (tuid of held[target]) {
                        if (tuid != uid) details.push({
                            'type': 'mrkdwn',
                            'text': `:eye-in-speech-bubble: You see <@${tuid}> was dealt *${alias ? alias : target}*.`
                        });
                    }
                }

                let blocks = [{
                    'type': 'section',
                    'text': {
                        'type': 'mrkdwn',
                        'text': summary
                    }
                }];
                if (details.length > 0)
                    blocks.push({
                        'type': 'context',
                        'elements': details
                    })

                await bot.startPrivateConversation(uid);
                await bot.say({
                    'text': summary,
                    'blocks': blocks
                });
            }

            dealt = Object.keys(dealt);

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';
            let summary = `${who} dealt *${dealt.length}* item${dealt.length != 1 ? 's' : ''} to <@${dealt.join('>, <@')}> by direct message.`;

            let blocks = [{
                'type': 'section',
                'text': {
                    'type': 'mrkdwn',
                    'text': summary
                }
            }];
            if (deck.length > 0)
                blocks.push({
                    'type': 'context',
                    'elements': [{
                        'type': 'mrkdwn',
                        'text': `:warning: There were *${deck.length}* item${deck.length != 1 ? 's' : ''} leftover.`
                    }]
                })

            await bot.startConversationInChannel(message.channel, message.user);
            await bot.reply(message, {
                'text': summary,
                'blocks': blocks
            });
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    const commas = /\s*,\s*/;
    function lex(expression, on=commas) {
        return expression.trim().split(on).filter(it => it.trim()).filter(Boolean);
    }

    // FISHER YATES SHUFFLE
    function shuffle(list) {
        for (let i = list.length-1; i >= 1; i--) {
            let j = randomInt(0, i);
            [list[i], list[j]] = [list[j], list[i]];
        }
    }

    function accept(tokens, like) {
        if (tokens.length == 0) return;
        if (like instanceof RegExp ? tokens[0].match(like) : tokens[0] == like) {
            return tokens.shift();
        }
        else return false;
    }

    function peek(tokens, like) {
        if (tokens.length == 0) return;
        if (like instanceof RegExp ? tokens[0].match(like) : tokens[0] == like) {
            return tokens[0];
        }
        else return false;
    }

    function expect(tokens, like) {
        if (tokens.length == 0) return;
        if (like instanceof RegExp ? tokens[0].match(like) : tokens[0] == like) {
            return tokens.shift();
        }
        else return tokens = null;
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
            item = [expect(tokens, /[^(,)]+/).trim()];
        }

        while (peek(tokens, /[:*]/)) {
            if (accept(tokens, ':')) {
                let take = Math.min(parseInt(expect(tokens, /[1-9][0-9]*/)), item.length);

                let build = [];
                for (let i = 1; i <= take; i++) {
                    let r = randomInt(0, item.length-1);
                    [item[0], item[r]] = [item[r], item[0]];
                    build.push(item.shift());
                }
                item = build;
            }
            else if (accept(tokens, '*')) {
                let take = parseInt(expect(tokens, /[1-9][0-9]*/));

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
