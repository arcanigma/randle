import { ApplicationCommandData, Client } from 'discord.js';
import { MAX_EMBED_DESCRIPTION } from '../constants';
import { registerApplicationCommand } from '../library/backend';
import { commas, itemize, trunc, wss } from '../library/factory';
import { blame } from '../library/message';
import { shuffleInPlace } from '../library/solve';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: 'CHAT_INPUT',
            name: 'shuffle',
            description: 'Shuffle items',
            options: [
                {
                    name: 'items',
                    type: 'STRING',
                    description: 'A list of items, a range size, or an @everyone, @here, or @role mention',
                    required: true
                },
            ]
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.isCommand() &&
            interaction.commandName === 'shuffle'
        )) return;

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
    });

};
