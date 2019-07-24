if (
    !process.env.SLACK_BOT_TOKEN ||
    !process.env.SLACK_CLIENT_ID ||
    !process.env.SLACK_CLIENT_SECRET ||
    !process.env.SLACK_SIGNING_SECRET
) {
    console.log('Missing a Slack app environment variable.');
    process.exit(1);
}

if (!process.env.MONGODB_URI) {
    console.log('Missing MongoDB URI environment variable.');
    process.exit(1);
}

const CONFIG = require('./config');

var { Botkit } = require('botkit'),
    { SlackAdapter, SlackEventMiddleware, SlackMessageTypeMiddleware  } = require('botbuilder-adapter-slack');

var adapter = new SlackAdapter({
    botToken: process.env.SLACK_BOT_TOKEN,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET
});
adapter.use(new SlackEventMiddleware());
adapter.use(new SlackMessageTypeMiddleware());

var controller = new Botkit({
    webhook_uri: '/api/messages',
    adapter: adapter,
    storage: undefined // TODO: enable state storage
});

var handler = {
    UserError: class extends Error {},

    error: async(err, bot, message) => {
        try {
            if (err instanceof handler.UserError)
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
            console.log(`Unhandled Error: ${err.message}`);
        }
    }
};

// require('./handlers/macro')(controller, handler, user_table);
require('./handlers/echo')(controller, handler);
require('./handlers/deck')(controller, handler);
// require('./handlers/fu')(controller, handler);
require('./handlers/roll')(controller, handler);
