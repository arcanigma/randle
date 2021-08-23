import { Client, TextChannel } from 'discord.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('channelUpdate', async (oldChannel, newChannel) => {
        if (oldChannel instanceof TextChannel && newChannel instanceof TextChannel) {
            if (newChannel.topic && newChannel.topic != oldChannel.topic) {
                await newChannel.send({
                    content: `_New channel topic:_ ${newChannel.topic}`
                });
            }
        }
    });

    console.debug('Registered topic updated event.');

};
