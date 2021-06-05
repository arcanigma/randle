import { ApplicationCommandManager, Client, Snowflake } from 'discord.js';

export const dev = true;

export const register = ({ client }: { client: Client }): void => {
    if (process.env.NODE_ENV != 'development') return;

    client.on('ready', () => {
        const slash: Parameters<ApplicationCommandManager['create']>[0] = {
            name: 'echo',
            description: 'Replies by echoing your input',
            options: [
                {
                    name: 'input',
                    type: 'STRING',
                    description: 'The input to be echoed',
                    required: true
                }
            ],
        };

        if (process.env.DISCORD_GUILD_ID)
            client.guilds.cache.get(process.env.DISCORD_GUILD_ID as Snowflake)?.commands.create(slash);
        else
            client.application?.commands.create(slash);

        console.debug('Registered echo command.');
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'echo') return;

        const input = interaction.options[0].value as string;

        console.debug(interaction);

        await interaction.reply(input, { ephemeral: true });
    });

};
