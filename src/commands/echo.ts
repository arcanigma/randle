import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputApplicationCommandData, CommandInteraction } from 'discord.js';

export const data: ChatInputApplicationCommandData = {
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
    ]
};

export async function execute (interaction: CommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased())
        throw 'This command can only be used in text-based channels.';

    const input = interaction.options.get('input')?.value as string;

    console.debug(input);

    await interaction.reply({
        content: input,
        ephemeral: true
    });
}
