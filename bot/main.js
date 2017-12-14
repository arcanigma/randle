var Botkit = require('botkit');

if (!process.env.SLACK_BOT_TOKEN) {
    console.log('Missing environment variable: Slack bot token.');
    process.exit(1);
}

var controller = Botkit.slackbot({
    debug: false
});

controller.spawn({
    token: process.env.SLACK_BOT_TOKEN
}).startRTM(function(err) {
    if (err) throw new Error(err);
});

var rng = require ('php-random-int');
var commands = {
    ping: require('./commands/ping')(controller, rng),
    fu: require('./commands/fu')(controller, rng)
};
