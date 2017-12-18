module.exports = function(controller) {

    controller.hears(
        /^!echo(.*)/,
        ['direct_message', 'direct_mention', 'mention', 'ambient'],
        function(bot, message) {
            bot.reply(message, match[1]);
        }
    );

};
