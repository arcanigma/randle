import { ApplicationCommandData, Client, ClientCommand, ClientEvent, ClientRoute, Collection, Events, GatewayIntentBits } from 'discord.js';
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
            if (folder == 'events') {
                const event = await import(filePath) as ClientEvent;
                if (event.once)
                    client.once(event.name, (...args) => event.execute(...args));
                else
                    client.on(event.name, (...args) => event.execute(...args));
                console.debug(`Discord client loaded ${event.name} event.`);
            }
            else if (folder == 'commands') {
                const command = await import(filePath) as ClientCommand;
                client.commands.set(command.data.name, command);
                if (process.env.REINSTALL_COMMANDS === 'true')
                    raw_commands.push(command.data);
                console.debug(`Discord client loaded ${command.data.name} command.`);
            }
            else if (folder == 'routes') {
                const route = await import(filePath) as ClientRoute;
                route.register(app, port, client);
                console.debug(`Express app loaded ${route.name} route on port ${port}.`);
            }
        }
    }

    client.once(Events.ClientReady, async (client) => {
        console.debug(`Discord client ready as ${client.user.username}.`);

        if (process.env.REINSTALL_COMMANDS === 'true') {
            await client.application.commands.set(raw_commands);
            console.debug(`Discord client reinstalled commands ${raw_commands.length} commands.`);
        }
    });

    await client.login(process.env.DISCORD_TOKEN);

    app.listen(port);
}
catch (error: unknown) {
    await sendBlame(error);
}
