if (!process.env.SLACK_BOT_TOKEN) {
    console.log('Missing environment variable: Slack bot token.');
    process.exit(1);
}

if (!process.env.MONGODB_URI) {
    console.log('Missing environment variable: MongoDB URI.');
    process.exit(1);
}

const CONFIG = require('./config');

var Botkit = require('botkit'),
    MongoDB = require('botkit-storage-mongo'),
    CachedStorage = require('./classes/cached-storage');

var controller = Botkit.slackbot({
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET,
    scopes: ['bot'],
    require_delivery: true,
    storage: MongoDB({
        mongoUri: process.env.MONGODB_URI,
        tables: undefined
    })
});

controller.spawn({
    token: process.env.SLACK_BOT_TOKEN
}).startRTM(function(err) {
    if (err) throw new Error(err);
});

var handler = {
    UserError: class extends Error {},
    error: function(err, bot, message) {
        if (err instanceof this.UserError) {
            bot.whisper(message, {
                'text': 'Your command has a problem.',
                'attachments': [
                    {
                        'text': `${err.message}`,
                        'color': 'warning'
                    }
                ]
            });
        }
        else {
            bot.whisper(message, {
                'text': 'Your message caused an error. Please report these details to the developer.',
                'attachments': [
                    {
                        'text': `*${err.name}:* ${err.message}`,
                        'color': 'danger'
                    },
                    {
                        'text': `*Location:* ${err.stack.match(/\w+.js:\d+:\d+/g)[0]}`
                    },
                    {
                        'text': `*Context:*  ${JSON.stringify(message.type, null, '\t')}`
                    },
                    {
                        'text': `*Message:*  ${JSON.stringify(message.text, null, '\t')}`
                    },
                    {
                        'text': `*Matches:*  ${JSON.stringify(message.match, null, '\t')}`
                    }
                ]
            });
        }
    }
};

var user_table = new CachedStorage(controller.storage.users, {
    'stdTTL': CONFIG.CACHE_TTL,
    'checkperiod': CONFIG.CACHE_CHECK_PERIOD
});

require('./handlers/macro')(controller, handler, user_table);
require('./handlers/echo')(controller, handler);
require('./handlers/deck')(controller, handler);
require('./handlers/fu')(controller, handler);
require('./handlers/roll')(controller, handler);
