import { Client } from 'discord.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', () => {
        console.debug('Ready.');
    });

};
