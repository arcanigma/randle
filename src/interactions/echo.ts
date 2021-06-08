import { Client } from 'discord.js';
import { registerSlashCommand } from '../library/backend';
import { ApplicationCommandData } from '../shims';

export const dev = true;

export const register = ({ client }: { client: Client }): void => {
    if (process.env.NODE_ENV != 'development') return;

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            name: 'echo',
            description: 'Replies by echoing your input',
            options: [
                {
                    name: 'input',
                    type: 'STRING',
                    description: 'The input to be echoed',
                    required: true
                }
            ],
        };

        await registerSlashCommand(slash, client);
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'echo') return;

        const input = interaction.options.get('input')?.value as string;

        console.debug(interaction);

        await interaction.reply(input, { ephemeral: true });
    });

};
