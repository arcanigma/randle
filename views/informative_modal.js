module.exports = async ({ title, error }) => {
    let blocks = [{
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: error
        }
    }];

    let view = {
        type: 'modal',
        title: {
            type: 'plain_text',
            text: title
        },
        close: {
            type: 'plain_text',
            text: 'Okay'
        },
        blocks: blocks
    };

    return JSON.stringify(view);
};
