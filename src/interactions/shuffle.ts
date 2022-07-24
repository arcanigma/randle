import { ApplicationCommandOptionType, ApplicationCommandType, CacheType, Client, Interaction, InteractionType } from 'discord.js';
import { MAX_EMBED_DESCRIPTION } from '../constants.js';
import { createSlashCommand } from '../library/backend.js';
import { commas, itemize, trunc, wss } from '../library/factory.js';
import { blame } from '../library/message.js';
import { shuffleInPlace } from '../library/solve.js';

export async function register ({ client }: { client: Client }): Promise<void> {
    await createSlashCommand(client, {
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
    });
}

export async function execute ({ interaction }: { interaction: Interaction<CacheType>}): Promise<boolean> {
    if (!(
        interaction.type === InteractionType.ApplicationCommand &&
        interaction.commandName === 'shuffle'
    )) return false;

    try {
        const elements = interaction.options.get('items')?.value as string,
            items = shuffleInPlace(itemize(elements, interaction));

        await interaction.reply({
            content: `${interaction.user.toString()} shuffled ${items.length != 1 ? 'items' : 'an item'}`,
            embeds: [{
                title: `${items.length} Item${items.length != 1 ? 's' : ''}`,
                description: trunc(commas(items.map(item => `**${wss(item)}**`)), MAX_EMBED_DESCRIPTION)
            }]
        });
    }
    catch (error: unknown) {
        await interaction.reply({
            embeds: blame({ error, interaction }),
            ephemeral: true
        });
    }

    return true;
}
