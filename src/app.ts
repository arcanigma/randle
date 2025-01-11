import { ActivityType, Client, ClientCommand, ClientEvent, ClientRoute, Collection, Events, GatewayIntentBits, PresenceUpdateStatus } from 'discord.js';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAINTENANCE_ACTIVITY, READY_ACTIVITY } from './commands/act.js';
import { sendBlame } from './library/messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    /*  REQUIREMENTS
        Intents:
            Guilds (to receive channelUpdate event)
        Scopes:
            bot
            applications.commands
        Bot Permissions:
            Use Slash Commands
            Send Messages
            Send Messages in Threads
            View Audit Log [fetched in channelUpdate handler]
    */
    const client = new Client({ intents: [
        GatewayIntentBits.Guilds
    ] });

    const app = express();
    const port = Number(process.env.PORT ?? 8080);

    for (const folder of [ 'routes', 'events', 'commands' ]) {
        const folderPath = path.join(__dirname, folder);
        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        if (folder == 'commands')
            client.commands = new Collection();

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
                console.debug(`Discord loaded ${command.data.name} command.`);
            }
        }
    }

    client.once(Events.ClientReady, async (client) => {
        if (process.env.REGISTER_COMMANDS === 'true') {
            const commands = [...client.commands.values()].map(it => it.data);
            await client.application.commands.set(commands);
            console.debug(`Discord registered ${commands.length} commands.`);
        }

        if (process.env.MAINTENANCE_MODE !== 'true') {
            console.debug('Discord ready.');
            client.user.setPresence({
                status: PresenceUpdateStatus.Online,
                activities: [{ name: READY_ACTIVITY, type: ActivityType.Custom }]
            });
        }
        else {
            console.debug('Discord in maintenance mode.');
            client.user.setPresence({
                status: PresenceUpdateStatus.DoNotDisturb,
                activities: [{ name: MAINTENANCE_ACTIVITY, type: ActivityType.Custom }]
            });
        }

        app.listen(port);
    });

    await client.login(process.env.DISCORD_TOKEN);
}
catch (error: unknown) {
    await sendBlame(error);
}
