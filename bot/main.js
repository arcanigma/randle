var Botkit = require('botkit');

if (!process.env.SLACK_BOT_TOKEN) {
    console.log('Missing environment variable: Slack bot token.');
    process.exit(1);
}

var controller = Botkit.slackbot({
    debug: false,
    require_delivery: true
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
}

var rng = {
    randomInt: require('../library/random-int'),
    fyShuffle: require('../library/fisher-yates')
};

var commands = {
    ping: require('./commands/ping')(controller),
    fu: require('./commands/fu')(controller, handler, rng),
    deck: require('./commands/deck')(controller, handler, rng)
};
