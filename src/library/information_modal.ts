import { SectionBlock, View } from '@slack/web-api';

export const view = ({title, error}: {title: string, error: unknown}): View => ({
    type: 'modal',
    title: {
        type: 'plain_text',
        text: title
    },
    close: {
        type: 'plain_text',
        text: 'Okay'
    },
    blocks: [<SectionBlock>{
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: error
        }
    }]
});
