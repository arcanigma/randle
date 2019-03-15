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
    retry: 5,
    token: process.env.SLACK_BOT_TOKEN
}).startRTM(function(err) {
    if (err) console.log(err);
});

var user_table = new CachedStorage(controller.storage.users, {
    'stdTTL': CONFIG.CACHE_TTL,
    'checkperiod': CONFIG.CACHE_CHECK_PERIOD
});

var handler = {
    UserError: class extends Error {},
    error: function(err, bot, message) {
        if (err instanceof this.UserError) {
            bot.whisper(message, {
                'text': 'Your command has a problem.',
                'blocks': [
                    {
                        'type': 'section',
                        'text': {
                            'type': 'plain_text',
                            'text': 'Your command has a problem. Please fix the problem and try again.'
                        }
                    },
                    {
                        'type': 'context',
                        'elements': [
                            {
                              'type': 'mrkdwn',
                              'text': `:warning: ${err.message}`
                            }
                        ]
                    }
                ]
            });
        }
        else {
            bot.whisper(message, {
                'text': 'Your message caused an error.',
                'blocks': [
                    {
                        'type': 'section',
                        'text': {
                            'type': 'plain_text',
                            'text': 'Your message caused an error. Please report these details to the developer.'
                        }
                    },
                    {
                        'type': 'context',
                        'elements': [
                            {
                              'type': 'mrkdwn',
                              'text': `*${err.name}:* ${err.message}`
                            },
                            {
                              'type': 'mrkdwn',
                              'text': `*Location:* ${err.stack.match(/\w+.js:\d+:\d+/g)[0]}`
                            },
                            {
                              'type': 'mrkdwn',
                              'text': `*Context:*  ${JSON.stringify(message.type)}`
                            },
                            {
                              'type': 'mrkdwn',
                              'text': `*Message:*  ${JSON.stringify(message.text)}`
                            }
                        ]
                    }
                ]
            });
        }
    }
};

require('./handlers/macro')(controller, handler, user_table);
require('./handlers/echo')(controller, handler);
require('./handlers/deck')(controller, handler);
// require('./handlers/fu')(controller, handler);
require('./handlers/roll')(controller, handler);
