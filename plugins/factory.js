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

const names = (list, user) => {
    return commas(
        list.sort(u => u == user ? -1 : 0)
            .map(u => u != user ? `<@${u}>` : 'you')
    ) || 'nobody';
};

// TODO refactor into informative modal?
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
                        text: 'Your command has a problem. Please correct the problem before trying again.'
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

module.exports = {
    who,
    commas,
    names,
    blame
};
