import { ChatInputApplicationCommandData, Client, MessageApplicationCommandData, UserApplicationCommandData } from 'discord.js';

export async function resetCommands (client: Client): Promise<void> {
    if (process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (!guild)
            throw `Unavailable guild <${process.env.DISCORD_GUILD_ID}>.`;

        await guild.commands.set([]);
        console.debug(`Reset commands on guild <${guild.name}>.`);
    }
    else {
        await client.application?.commands.set([]);
        console.debug('Reset commands globally.');
    }
}

export async function createSlashCommand (client: Client, command: ChatInputApplicationCommandData): Promise<void> {
    if (process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (!guild)
            throw `Unavailable guild <${process.env.DISCORD_GUILD_ID}>.`;

        await guild.commands.create(command);
        console.debug(`Registered </${command.name}> slash command on guild <${guild.name}>.`);
    }
    else {
        await client.application?.commands.create(command);
        console.debug(`Registered </${command.name}> slash command globally.`);
    }
}

export async function createMenuCommand (client: Client, command: MessageApplicationCommandData | UserApplicationCommandData): Promise<void> {
    if (process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (!guild)
            throw `Unavailable guild <${process.env.DISCORD_GUILD_ID}>.`;

        await guild.commands.create(command);
        console.debug(`Registered <${command.name}> menu command on guild <${guild.name}>.`);
    }
    else {
        await client.application?.commands.create(command);
        console.debug(`Registered <${command.name}> menu command globally.`);
    }
}
