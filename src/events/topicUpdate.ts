import { Client, TextChannel } from 'discord.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('channelUpdate', (oldChannel, newChannel) => {
        if (oldChannel.type == 'text' && newChannel.type == 'text') {
            const oldTextChannel = oldChannel as TextChannel,
                newTextChannel = newChannel as TextChannel;

            if (newTextChannel.topic && newTextChannel.topic != oldTextChannel.topic) {
                const content = `_new channel topic:_ ${newTextChannel.topic}`;
                void newTextChannel.send(content);
            }
        }
    });

};
