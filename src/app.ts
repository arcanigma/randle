import { Client } from 'discord.js';
import express from 'express';
import * as topicUpdated from './events/topicUpdated.js';
import * as draw from './interactions/draw.js';
import * as echo from './interactions/echo.js';
import * as panic from './interactions/panic.js';
import * as poll from './interactions/poll.js';
import * as roll from './interactions/roll.js';
import * as run from './interactions/run.js';
import * as shuffle from './interactions/shuffle.js';
import * as who from './interactions/who.js';
import * as logo from './routes/logo.js';
import * as status from './routes/status.js';

// TODO anonymous send-and-reply by proxy
// TODO support for macros

const client = new Client({ intents: [
    'GUILDS',
    'GUILD_MESSAGES',
    'GUILD_MEMBERS',
    'GUILD_PRESENCES',
    'GUILD_VOICE_STATES'
] });

void client.login(process.env.DISCORD_BOT_TOKEN);

client.setMaxListeners(25);

// TODO packages: sequelize, @types/sequelize, pg, pg-hstore
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

draw.register({ client });
echo.register({ client });
panic.register({ client });
poll.register({ client });
roll.register({ client });
run.register({ client });
shuffle.register({ client });
who.register({ client });

topicUpdated.register({ client });

client.once('ready', () => {
    console.debug('Discord ready.');
});

const app = express();

status.register({ app });
logo.register({ app });

const PORT = Number(process.env.PORT ?? 80);

app.listen(PORT, () => {
    console.debug(`Express ready on port <${PORT}>.`);
});
