import { ApplicationCommandData, ApplicationCommandOptionType, ApplicationCommandType, Client, InteractionType } from 'discord.js';
import { registerApplicationCommand } from '../library/backend.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: ApplicationCommandType.ChatInput,
            name: 'echo',
            description: 'Replies by echoing your input',
            options: [
                {
                    name: 'input',
                    type: ApplicationCommandOptionType.String,
                    description: 'The input to be echoed',
                    required: true
                }
            ],
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.type === InteractionType.ApplicationCommand &&
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
