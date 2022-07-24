import { ApplicationCommandData, Client } from 'discord.js';

export function createApplicationCommand (client: Client, command: ApplicationCommandData): void {
    if (process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (!guild)
            throw `Unavailable guild <${process.env.DISCORD_GUILD_ID}>.`;

        // USE ONLY AS NEEDED
        // void guild.commands.set([]);

        guild.commands.create(command).then(() => {
            console.debug(`Registered <${command.name}> command on guild <${guild.name}>.`);
        }, () => {
            console.debug(`Unable to register <${command.name}> command on guild <${guild.name}>.`);
        });
    }
    else {
        if (!client.application)
            throw 'Unavailable application.';

        client.application.commands.create(command).then(() => {
            console.debug(`Registered <${command.name}> command globally.`);
        }, () => {
            console.debug(`Unable to register <${command.name}> command globally.`);
        });
    }
}
