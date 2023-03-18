import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import * as topicUpdated from './events/topicUpdated.js';
import * as draw from './interactions/draw.js';
import * as echo from './interactions/echo.js';
import * as launch from './interactions/launch.js';
import * as panic from './interactions/panic.js';
import * as poll from './interactions/poll.js';
import * as roll from './interactions/roll.js';
import * as shuffle from './interactions/shuffle.js';
import * as who from './interactions/who.js';
import { resetCommands } from './library/backend.js';
import * as health from './routes/health.js';
import * as logo from './routes/logo.js';

// TODO anonymous send-and-reply
// TODO macros

// TODO reevaluate which intents are needed
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
] });

client.login(process.env.DISCORD_BOT_TOKEN).then(() => {
    console.debug('Bot logged into Discord.');
}, () => {
    console.debug('Bot unable to log into Discord.');
    process.exitCode = 1;
});

const interactions = [
    roll,
    draw,
    shuffle,
    poll,
    panic,
    echo,
    who,
    launch
];

client.once('ready', async () => {
    if (process.env.RESET_COMMANDS)
        await resetCommands(client);

    for (const interaction of interactions)
        await interaction.register({ client });
});

client.on('interactionCreate', async interaction => {
    for (const event of interactions)
        if (await event.execute({ interaction }))
            return;
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    await topicUpdated.execute({ oldChannel, newChannel });
});

const app = express();

const routes = [
    health,
    logo
];

const port = Number(process.env.PORT ?? 80);
app.listen(port, () => {
    for (const route of routes)
        route.register({ app });

    console.debug(`Listening on port <${port}>.`);
});

// // packages: sequelize, @types/sequelize, pg, pg-hstore
// const db = new Sequelize(process.env.DATABASE_URL ?? '', {
//     dialect: 'postgres',
//     logging: false,
//     dialectOptions: {
//         ssl: {
//             rejectUnauthorized: false
//         }
//     }
// });

// void db.sync();
