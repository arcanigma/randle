module.exports = function(controller) {

    controller.hears(
        ['^!ping'],
        ['direct_message', 'direct_mention', 'mention', 'ambient'],
        function(bot, message) {
            bot.reply(message, 'pong!');
        }
    );

}
