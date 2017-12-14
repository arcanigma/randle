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

var rng = {
    randomInt: require ('../library/random-int'),
    fyShuffle: require ('../library/fisher-yates')
};
var commands = {
    ping: require('./commands/ping')(controller),
    fu: require('./commands/fu')(controller, rng)
};
