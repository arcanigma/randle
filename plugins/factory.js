const { collection } = require('../plugins/state.js');

const who = (message, pronoun) => {
    return message.channel_type != 'im' ? `<@${message.user}>` : pronoun;
};

const commas = (list) => {
    if (list.length == 1)
        return list[0];
    else if (list.length == 2)
        return `${list[0]} and ${list[1]}`;
    else if (list.length >= 3)
        return `${list.slice(0, -1).join(', ')}, and ${list.slice(-1)}`;
};

const blame = (error, message) => {
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
};

const macroize = async (clauses, uid) => {
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

    for (let i = 0; i < clauses.length; i++) {
        clauses[i] = clauses[i].replace(
            new RegExp(`\\b(${Object.keys(macros).join('|')})\\b`, 'gi'),
            (match) => macros[match.toLowerCase()]
        );
    }
};

module.exports = {
    who,
    commas,
    blame,
    macroize
};
