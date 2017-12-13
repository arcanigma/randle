var Botkit = require('botkit');

if (!process.env.SLACK_BOT_TOKEN) {
    console.log('Error: specify bot token in environment.');
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

controller.hears(['hello', 'hi'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    bot.reply(message, "Hello.");
});
