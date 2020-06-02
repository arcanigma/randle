import { View, SectionBlock } from '@slack/web-api';

export default async ({title, error}: {title: string, error: unknown}): Promise<View> => ({
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
