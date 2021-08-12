import { ApplicationCommand, ApplicationCommandData, Client } from 'discord.js';

export async function registerSlashCommand (slash: ApplicationCommandData, client: Client): Promise<ApplicationCommand> {
    if (process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (!guild)
            throw `Unavailable guild <${process.env.DISCORD_GUILD_ID}>.`;

        console.debug(`Registered /${slash.name} on guild <${guild.name}>.`);

        return await guild.commands.create(slash);
    }
    else {
        if (!client.application)
            throw 'Unavailable application.';

        console.debug(`Registered /${slash.name} on all guilds.`);

        return await client.application.commands.create(slash);
    }
}
