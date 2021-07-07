import { ApplicationCommandData, Client, Interaction, Snowflake } from 'discord.js';
import { MAX_EMBED_DESCRIPTION } from '../constants';
import { registerSlashCommand } from '../library/backend';
import { commas, trunc, wss } from '../library/factory';
import { blame } from '../library/message';
import { choose, shuffleInPlace } from '../library/solve';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
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

        await registerSlashCommand(slash, client);
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'shuffle') return;

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

        await registerSlashCommand(slash, client);
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'draw') return;

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

const re_role = /^<@&(\d+)>$/;
async function itemize (text: string, interaction: Interaction): Promise<string[]> {
    let items = text.split(',').map(it => it.trim()).filter(Boolean),
        match;
    if (items.length == 1) {
        if (Number(items[0]) >= 1 && Number(items[0]) % 1 == 0) {
            items = (<number[]> Array(Number(items[0])).fill(1)).map((v, i) => String(v + i));
        }
        else if (items[0] == '@everyone' || items[0] == '@here') {
            const role = interaction.guild?.roles.everyone;
            if (!role)
                throw `Unsupported mention <${items[0]}>.`;

            items = role.members
                .filter(them => !them.user.bot)
                .filter(them => items[0] != '@here' || them.presence?.status == 'online')
                .map(them => them.toString());
        }
        else if ((match = re_role.exec(items[0]))) {
            const role = await interaction.guild?.roles.fetch(match[1] as Snowflake);
            if (!role)
                throw `Unsupported role <${match[1]}>.`;

            items = role.members
                .filter(them => !them.user.bot)
                .map(them => them.toString());
        }
        // TODO support macros
    }
    else if (items.length < 1) {
        throw 'Number of items must be at least 1.';
    }
    return items;
}
