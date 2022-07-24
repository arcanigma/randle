import { ApplicationCommand, ApplicationCommandData, Client } from 'discord.js';

export async function registerApplicationCommand (command: ApplicationCommandData, client: Client): Promise<ApplicationCommand> {
    if (process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (!guild)
            throw `Unavailable guild <${process.env.DISCORD_GUILD_ID}>.`;

        console.debug(`Registered /${command.name} on guild <${guild.name}>.`);
        return await guild.commands.create(command);
    }
    else {
        if (!client.application)
            throw 'Unavailable application.';

        console.debug(`Registered /${command.name} globally.`);
        return await client.application.commands.create(command);
    }
}
