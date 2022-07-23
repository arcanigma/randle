import { ApplicationCommandData, Client } from 'discord.js';
import { registerApplicationCommand } from '../library/backend.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: 'CHAT_INPUT',
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

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.isCommand() &&
            interaction.commandName === 'echo'
        )) return;

        const input = interaction.options.get('input')?.value as string;

        console.debug(interaction);

        await interaction.reply({
            content: input,
            ephemeral: true
        });
    });

};
