const { collection } = require('../plugins/storage.js');

module.exports = {

    // TODO tidy with payload parameter
    who: (pronoun, message, uid) => {
        if (uid)
            return message.user == uid ? pronoun : `<@${message.user}>`;
        else
            return message.channel_type == 'im' ? pronoun : `<@${message.user}>`;
    },

    blame: (error, message) => {
        if (error instanceof Error) {
            return {
                text: 'Your message caused an error.',
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'plain_text',
                            text: 'Your message caused an error. Please report these details to the developer.'
                        }
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                              type: 'mrkdwn',
                              text: `:octagonal_sign: *${error.name}:* ${error.message}`
                            },
                            {
                              type: 'mrkdwn',
                              text: `*Location:* ${error.stack.match(/\w+.js:\d+:\d+/g)[0]}`
                            },
                            {
                              type: 'mrkdwn',
                              text: `*Context:* ${message.channel_type}-${message.channel}`
                            },
                            {
                              type: 'mrkdwn',
                              text: `*Text:* ${message.text}`
                            }
                        ]
                    }
                ]
            };
        }
        else {
            return {
                text: 'Your command has a problem.',
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'plain_text',
                            text: 'Your command has a problem. Please fix the problem and try again.'
                        }
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                              type: 'mrkdwn',
                              text: `:warning: *User Error:* ${error}`
                            }
                        ]
                    }
                ]
            };
        }
    },

    macroize: async (strings, uid) => { // TODO async?
        let coll = await collection('macros');
        let macros = (await coll.findOne(
            { _id: uid },
            { projection: { _id: 0} }
        )) || {} ;

        const DICTIONARY = { // TODO super use creates, bot owns
            adv: '2d20H',
            dis: '2d20L'
        }
        macros = macros ? Object.assign(macros, DICTIONARY): DICTIONARY;

        for (let i = 0; i < strings.length; i++) {
            strings[i] = strings[i].replace(
                new RegExp(`\\b(${Object.keys(macros).join('|')})\\b`, 'gi'),
                (match) => macros[match.toLowerCase()]
            );
        }
    }

};
