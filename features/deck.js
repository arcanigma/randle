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

    // TODO add "showing X:A, Y:B, Z:C" clause
    controller.hears(/^!?deal\s+(.+)$/i, CONFIG.HEAR_ANYWHERE, async(bot, message) => {
        try {
            const lexer = /([(),:*])/;
            let tokens = lex(message.matches[1], lexer);

            let deck = parse_list(tokens);
            if (tokens.length > 0)
                await controller.plugins.handler.raise(`Unexpected ${tokens[0]}`)

            let uids = (await bot.api.conversations.members({channel: message.channel})).members;

            let dealt = {};
            for (uid of uids) {
                let user = (await bot.api.users.info({user: uid})).user;
                if (!user.is_bot) {
                    if (deck.length > 0)
                        dealt[uid] = deck.shift();
                    else
                        await controller.plugins.handler.raise(`You must deal enough items for all users.`)
                }
            }

            for (uid in dealt) {
                let who = uid != message.user ? `<@${message.user}>` : 'You';

                await bot.startPrivateConversation(uid);
                await bot.say({'text': `${who} dealt ${who != 'You' ? 'you' : 'yourself'} *${dealt[uid]}*.`});
            }

            let who = !CONFIG.HEAR_DIRECTLY.includes(message.type) ? `<@${message.user}>` : 'You';

            await bot.startConversationInChannel(message.channel, message.user);
            dealt = Object.keys(dealt);
            if (deck.length == 0)
                await bot.reply(message, {
                    'text': `${who} dealt *${dealt.length}* item${dealt.length != 1 ? 's' : ''} to <@${dealt.join('>, <@')}> by direct message.`
                });
            else
                await bot.reply(message, {
                    'text': `${who} dealt *${dealt.length}* item${dealt.length != 1 ? 's' : ''} to <@${dealt.join('>, <@')}> by direct message with *${deck.length}* item${deck.length != 1 ? 's' : ''} leftover.`
                });
        }
        catch(err) {
            await controller.plugins.handler.explain(err, bot, message);
        }
    });

    // TODO refactor optional second parameter
    const commas = /\s*,\s*/;
    function lex(expression, on=commas) {
        return expression.trim().split(on).filter(it => it.trim()).filter(Boolean);
    }

    // FISHER YATES
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
