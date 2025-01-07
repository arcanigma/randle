import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputApplicationCommandData, CommandInteraction } from 'discord.js';
import { MAX_EMBED_DESCRIPTION } from '../library/constants.js';
import { shuffleInPlace } from '../library/lists.js';
import { commas, itemize, trunc, wss } from '../library/texts.js';

export const data: ChatInputApplicationCommandData = {
    type: ApplicationCommandType.ChatInput,
    name: 'shuffle',
    description: 'Shuffle items',
    options: [
        {
            name: 'items',
            type: ApplicationCommandOptionType.String,
            description: 'A list of items, a range size, or an @everyone, @here, or @role mention',
            required: true
        },
    ]
};

export async function execute (interaction: CommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased())
        throw 'This command can only be used in text-based channels.';

    const elements = interaction.options.get('items')?.value as string,
        items = shuffleInPlace(itemize(elements));

    await interaction.reply({
        content: `${interaction.user.toString()} shuffled ${items.length != 1 ? 'items' : 'an item'}`,
        embeds: [{
            title: `${items.length} Item${items.length != 1 ? 's' : ''}`,
            description: trunc(commas(items.map(item => `**${wss(item)}**`)), MAX_EMBED_DESCRIPTION)
        }]
    });
}
