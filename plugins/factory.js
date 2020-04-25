module.exports = {

    who: (pronoun, message, uid) => {
        if (uid)
            return message.user == uid ? pronoun : `<@${message.user}>`;
        else
            return message.channel_type == 'im' ? pronoun : `<@${message.user}>`;
    },

    blame: (error, message) => {
        if (error instanceof Error) {
            return {
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
                              'text': `:octagonal_sign: *${error.name}:* ${error.message}`
                            },
                            {
                              'type': 'mrkdwn',
                              'text': `*Location:* ${error.stack.match(/\w+.js:\d+:\d+/g)[0]}`
                            },
                            {
                              'type': 'mrkdwn',
                              'text': `*Channel:* ${message.channel} (${message.channel_type})`
                            },
                            {
                              'type': 'mrkdwn',
                              'text': `*Message:* ${JSON.stringify(message.text)}`
                            }
                        ]
                    }
                ]
            };
        }
        else {
            return {
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
                              'text': `:warning: *User Error:* ${error}`
                            }
                        ]
                    }
                ]
            };
        }
    }

};
