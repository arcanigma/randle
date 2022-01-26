import { ApplicationCommandData, Client } from 'discord.js';
import { MAX_EMBED_DESCRIPTION } from '../constants';
import { registerApplicationCommand } from '../library/backend';
import { commas, itemize, trunc, wss } from '../library/factory';
import { blame } from '../library/message';
import { choose, shuffleInPlace } from '../library/solve';

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
            const raw_items = interaction.options.get('items')?.value as string;

            const items = shuffleInPlace(await itemize(raw_items, interaction));

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

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: 'CHAT_INPUT',
            name: 'draw',
            description: 'Draw some shuffled items',
            options: [
                {
                    name: 'items',
                    type: 'STRING',
                    description: 'A list of items, a range size, or an @everyone, @here, or @role mention',
                    required: true
                },
                {
                    name: 'quantity',
                    type: 'INTEGER',
                    description: 'Number of items to draw (or 1 by default)',
                    required: false
                }
            ]
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.isCommand() &&
            interaction.commandName === 'draw'
        )) return;

        try {
            const raw_items = interaction.options.get('items')?.value as string,
                quantity = interaction.options.get('quantity')?.value as number ?? 1;

            let items = await itemize(raw_items, interaction);

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
