import { ActivityType, ApplicationCommandData, Client, ClientCommand, ClientEvent, ClientRoute, Collection, Events, GatewayIntentBits, PresenceUpdateStatus } from 'discord.js';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendBlame } from './library/messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const client = new Client({ intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ] });

    const raw_commands: ApplicationCommandData[] = [];
    client.commands = new Collection();

    const app = express();
    const port = Number(process.env.PORT ?? 8080);

    for (const folder of [ 'events', 'commands', 'routes' ]) {
        const folderPath = path.join(__dirname, folder);
        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (folder == 'routes') {
                const route = await import(filePath) as ClientRoute;
                route.register(app, port, client);
                console.debug(`Express loaded ${route.name} route on port ${port}.`);
            }
            else if (folder == 'events') {
                const event = await import(filePath) as ClientEvent;
                if (event.once)
                    client.once(event.name, (...args) => event.execute(...args));
                else
                    client.on(event.name, (...args) => event.execute(...args));
                console.debug(`Discord loaded ${event.name} event.`);
            }
            else if (folder == 'commands') {
                const command = await import(filePath) as ClientCommand;
                client.commands.set(command.data.name, command);
                if (process.env.REGISTER_COMMANDS === 'true')
                    raw_commands.push(command.data);
                console.debug(`Discord loaded ${command.data.name} command.`);
            }
        }
    }

    client.once(Events.ClientReady, async (client) => {
        if (process.env.MAINTENANCE_MODE !== 'true') {
            console.debug('Discord ready.');
            client.user.setPresence({
                status: PresenceUpdateStatus.Online,
                activities: [{ name: '🎲 Ready to Roll', type: ActivityType.Custom }]
            });
        }
        else {
            console.debug('Discord in maintenance mode.');
            client.user.setPresence({
                status: PresenceUpdateStatus.DoNotDisturb,
                activities: [{ name: '🏗️ Down for Maintenance', type: ActivityType.Custom }]
            });
        }

        if (process.env.REGISTER_COMMANDS === 'true') {
            await client.application.commands.set(raw_commands);
            console.debug(`Discord registered commands ${raw_commands.length} commands.`);
        }

        app.listen(port);
    });

    await client.login(process.env.DISCORD_TOKEN);
}
catch (error: unknown) {
    await sendBlame(error);
}
