import { Channel, TextChannel } from 'discord.js';

export async function execute ({ oldChannel, newChannel }: { oldChannel: Channel; newChannel: Channel }): Promise<boolean> {
    if (oldChannel instanceof TextChannel && newChannel instanceof TextChannel) {
        if (newChannel.topic && newChannel.topic != oldChannel.topic) {
            await newChannel.send({
                content: `_New channel topic:_ ${newChannel.topic}`
            });
        }
    }

    return true;
}
