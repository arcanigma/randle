import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputApplicationCommandData, CommandInteraction, MessageFlags } from 'discord.js';
import { MAX_MESSAGE_LENGTH } from '../library/constants.js';

export const data: ChatInputApplicationCommandData = {
    type: ApplicationCommandType.ChatInput,
    name: 'echo',
    description: 'Echo your input',
    options: [
        {
            name: 'input',
            type: ApplicationCommandOptionType.String,
            description: 'An input',
            required: true,
            max_length: MAX_MESSAGE_LENGTH
        }
    ]
};

export async function execute (interaction: CommandInteraction): Promise<void> {
    const input = interaction.options.get('input')?.value as string;

    await interaction.reply({
        content: input,
        flags: MessageFlags.Ephemeral
    });
}
