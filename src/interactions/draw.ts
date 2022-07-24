import { ApplicationCommandData, ApplicationCommandOptionType, ApplicationCommandType, Client, InteractionType } from 'discord.js';
import { MAX_EMBED_DESCRIPTION } from '../constants.js';
import { registerApplicationCommand } from '../library/backend.js';
import { commas, itemize, trunc, wss } from '../library/factory.js';
import { blame } from '../library/message.js';
import { choose } from '../library/solve.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: ApplicationCommandType.ChatInput,
            name: 'draw',
            description: 'Draw some shuffled items',
            options: [
                {
                    name: 'items',
                    type: ApplicationCommandOptionType.String,
                    description: 'A list of items, a range size, or an @everyone, @here, or @role mention',
                    required: true
                },
                {
                    name: 'quantity',
                    type: ApplicationCommandOptionType.Integer,
                    description: 'Number of items to draw (or 1 by default)',
                    required: false
                }
            ]
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.type === InteractionType.ApplicationCommand &&
            interaction.commandName === 'draw'
        )) return;

        try {
            const elements = interaction.options.get('items')?.value as string,
                quantity = interaction.options.get('quantity')?.value as number ?? 1;

            let items = itemize(elements, interaction);

            if (items.length < 1)
                throw 'At least 1 item is required.';

            if (items.length < quantity)
                throw 'Quantity must not exceed the number of items.';

            items = choose(items, quantity);

            await interaction.reply({
                content: `${interaction.user.toString()} drew ${items.length != 1 ? 'items' : 'an item'}`,
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
