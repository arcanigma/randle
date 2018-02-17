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
    error: function(bot, message, err) {
        bot.whisper(message, {
            'text': `<@${message.user}>, your command caused an error. Please report it to the developer.`,
            'attachments': [{
                'text': err.toString(),
                'color': 'danger'
            }]
        });
    }
};

var user_db = new CachedStorage(controller.storage.users, {
    'stdTTL': CONFIG.CACHE_TTL,
    'checkperiod': CONFIG.CACHE_CHECK_PERIOD
});

require('./handlers/echo')(controller);
require('./handlers/macro')(controller, handler, user_db);
require('./handlers/roll')(controller, handler);
// require('./handlers/roll2')(controller, handler, user_db);
// require('./handlers/fu')(controller, handler);
// require('./handlers/deck')(controller, handler);
