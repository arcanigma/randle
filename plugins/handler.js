module.exports = function(botkit) {
    class UserError extends Error {};

    return {
        name: 'Error Handler',

        init: function(controller) {
            controller.addPluginExtension('handler', this);
        },

        raise: async(err) => {
            throw new UserError(err);
        },

        explain: async(err, bot, message) => {
            try {
                if (err instanceof UserError)
                    await bot.replyEphemeral(message, {
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
                else
                    await bot.replyEphemeral(message, {
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
            catch(err) {
                console.log(`Error in Handler Extension: ${err.message}`);
            }
        }
    };

};
