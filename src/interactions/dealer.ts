import { Client, Interaction, Snowflake, TextChannel } from 'discord.js';
import { MAX_EMBED_DESCRIPTION } from '../constants';
import { commas, trunc, wss } from '../library/factory';
import { blame } from '../library/messages';
import { choose, shuffleInPlace } from '../library/solving';
import { ApplicationCommandData } from '../shims';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', () => {
        const slash: ApplicationCommandData = {
            name: 'shuffle',
            description: 'Shuffle items',
            options: [
                {
                    name: 'items',
                    type: 'STRING',
                    description: 'A list of items, a counting number, or the @everyone mention',
                    required: true
                },
            ]
        };

        if (process.env.DISCORD_GUILD_ID)
            client.guilds.cache.get(process.env.DISCORD_GUILD_ID as Snowflake)?.commands.create(slash);
        else
            client.application?.commands.create(slash);

        console.debug('Registered shuffle command.');
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'shuffle') return;

        try {
            const raw_items = interaction.options[0].value as string;

            const items = shuffleInPlace(itemize(raw_items, interaction));

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

    client.on('ready', () => {
        const slash: ApplicationCommandData = {
            name: 'draw',
            description: 'Draw some shuffled items',
            options: [
                {
                    name: 'items',
                    type: 'STRING',
                    description: 'A list of items, a counting number, or the @everyone mention',
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

        if (process.env.DISCORD_GUILD_ID)
            client.guilds.cache.get(process.env.DISCORD_GUILD_ID as Snowflake)?.commands.create(slash);
        else
            client.application?.commands.create(slash);

        console.debug('Registered draw command.');
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'draw') return;

        try {
            const raw_items = interaction.options[0].value as string,
                quantity = interaction.options[1]?.value as number ?? 1;

            if (quantity < 1)
                throw 'Quantity must be at least 1.';

            const items = choose(itemize(raw_items, interaction), quantity);

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

function itemize (text: string, interaction: Interaction): string[] {
    let items = text.split(',').map(it => it.trim()).filter(Boolean);
    if (items.length == 1) {
        if (Number(items[0]) >= 1 && Number(items[0]) % 1 == 0) {
            items = (<number[]> Array(Number(items[0])).fill(1)).map((v, i) => String(v + i));
        }
        else if (items[0] == '@everyone') {
            let members;
            if (interaction.channel instanceof TextChannel)
                members = interaction.channel.members;
            else
                throw `Unsupported mention <${interaction.channel?.toString() ?? 'undefined'}>.`;
            items = members.filter(them => !them.user.bot).map(them => them.toString());
        }
        // TODO support macro source
    }
    else if (items.length < 1) {
        throw 'Number of items must be at least 1.';
    }
    return items;
}
