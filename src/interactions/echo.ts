import { ApplicationCommandData, Client } from 'discord.js';
import { registerSlashCommand } from '../library/backend';

export const register = ({ client }: { client: Client }): void => {

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

        await interaction.reply({
            content: input,
            ephemeral: true
        });
    });

};
