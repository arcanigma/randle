import { Client, TextChannel, User } from 'discord.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('channelUpdate', async (oldChannel, newChannel) => {
        if (oldChannel instanceof TextChannel && newChannel instanceof TextChannel) {
            const log = (await newChannel.guild.fetchAuditLogs({
                limit: 1,
                type: 'CHANNEL_UPDATE',
            })).entries.first();

            if (newChannel.topic && newChannel.topic != oldChannel.topic) {
                await newChannel.send({
                    content: log?.executor instanceof User
                        ? `_${log.executor.toString()} set the channel topic:_ ${newChannel.topic}`
                        : `_New channel topic:_ ${newChannel.topic}`
                });
            }
        }
    });

    console.debug('Registered topic updated event.');

};
