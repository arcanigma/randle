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

console.debug('Creating Express client.');

const app = express();
const port = Number(process.env.PORT ?? 80);

console.debug('Listening Express client.');

app.listen(port, () => {
    console.debug('Starting Express features.');

    health.register({ app, port, client });
    logo.register({ app, port });

    console.debug('Ending Express features.');
});

console.debug('Creating Discord client.');

// TODO reevaluate which intents are needed
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
] });

console.debug('Logging Discord client.');

client.login(process.env.DISCORD_BOT_TOKEN).then(() => {
    client.once('ready', async () => {
        console.debug('Starting Discord features.');

        if (process.env.RESET_COMMANDS)
            await resetCommands(client);

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

        for (const interaction of interactions)
            await interaction.register({ client });

        client.on('interactionCreate', async interaction => {
            for (const event of interactions)
                if (await event.execute({ interaction }))
                    return;
        });

        client.on('channelUpdate', async (oldChannel, newChannel) => {
            await topicUpdated.execute({ oldChannel, newChannel });
        });

        console.debug('Ending Discord features.');
    });
}, () => {
    console.debug('Terminating Discord bot.');
    process.exit(1);
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
