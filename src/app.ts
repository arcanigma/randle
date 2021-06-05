import { Client } from 'discord.js';
import express from 'express';
import * as topicUpdated from './events/topicUpdated';
import * as dealer from './interactions/dealer';
import * as echo from './interactions/echo';
import * as roll from './interactions/roll';
import * as logo from './routes/logo';
import * as status from './routes/status';

const
    INTERACTIONS = [ echo, roll, dealer ],
    EVENTS = [topicUpdated],
    ROUTES = [ status, logo ];

const client = new Client({ intents: [ 'GUILDS', 'GUILD_MESSAGES', 'GUILD_PRESENCES' ] });

void client.login(process.env.DISCORD_BOT_TOKEN);

[ ...INTERACTIONS, ...EVENTS ].forEach(it => it.register({ client }) );

client.on('ready', () =>
    console.debug('Discord ready.')
);

const app = express();

ROUTES.forEach(it => it.register({ app }) );

const PORT = Number(process.env.PORT ?? 80);

app.listen(PORT, () =>
    console.debug(`Express ready (port ${PORT}).`)
);
