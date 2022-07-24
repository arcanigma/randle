import { ApplicationCommandData, Client } from 'discord.js';

export function createApplicationCommand (client: Client, command: ApplicationCommandData): void {
    if (process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (!guild)
            throw `Unavailable guild <${process.env.DISCORD_GUILD_ID}>.`;

        guild.commands.create(command).then(() => {
            console.debug(`Registered /${command.name} on guild <${guild.name}>.`);
        }, () => {
            console.debug(`Unable to register /${command.name} on guild <${guild.name}>.`);
        });
    }
    else {
        if (!client.application)
            throw 'Unavailable application.';

        client.application.commands.create(command).then(() => {
            console.debug(`Registered /${command.name} globally.`);
        }, () => {
            console.debug(`Unable to register /${command.name} globally.`);
        });
    }
}
