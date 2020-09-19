import { Context } from '@slack/bolt';
import { WebAPICallResult, WebClient } from '@slack/web-api';

export async function getMembers (channel: string, context: Context, client: WebClient): Promise<string[]> {
    const members = (await client.conversations.members({
        token: <string> context.botToken,
        channel: channel
    }) as WebAPICallResult & {
        members: string[];
    }).members;

    const filtered = [];
    for (const member of members) {
        const is_bot = (await client.users.info({
            token: <string> context.botToken,
            user: member
        }) as WebAPICallResult & {
            user: {is_bot: boolean};
        }).user.is_bot;

        if (!is_bot)
            filtered.push(member);
    }

    return filtered;
}
