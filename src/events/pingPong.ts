import { Client } from 'discord.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('message', message => {
        if (message.content === 'ping') {
            void message.channel.send('pong');
        }
    });

};
