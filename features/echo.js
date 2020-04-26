const { blame } = require('../plugins/factory.js'),
      { nonthread, direct, debug } = require('../plugins/listen.js');

module.exports = (app) => {

    const re_echo = /^!?echo\b(.*)/i;
    app.message(nonthread, direct, re_echo, debug, async ({ message, context, say }) => {
        try {
            await say(context.matches[1].trim());
        }
        catch (err) {
            await say(blame(err));
        }
    });

    const re_throw = /^!?throw\s+(system|user)\s+error\b(.*)/i;
    app.message(nonthread, direct, re_throw, debug, async ({ message, context, say }) => {
        try {
            if (context.matches[1] == 'system')
                throw new Error(context.matches[2] || 'undefined');
            else if (context.matches[1] == 'user')
                await say(blame(context.matches[2] || 'undefined'));
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

};
