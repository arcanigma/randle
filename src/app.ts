import { Client } from 'discord.js';
import express from 'express';
import * as echo from './events/echo';
import * as topicUpdated from './events/topicUpdated';
import * as logo from './routes/logo';
import * as status from './routes/status';

const client = new Client({ intents: [ 'GUILDS', 'GUILD_MESSAGES' ] });

void client.login(process.env.DISCORD_BOT_TOKEN);

[ echo, topicUpdated ].forEach(it => {
    it.register({ client });
});

client.on('ready', () => {
    console.debug('Discord ready.');
});

const app = express();

[ status, logo ].forEach(it => {
    it.register({ app });
});

const PORT = Number(process.env.PORT ?? 80);

app.listen(PORT, () => {
    console.debug(`Express ready on port ${PORT}.`);
});
