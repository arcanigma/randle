import { Client } from 'discord.js';
import express from 'express';
import * as pingPong from './events/pingPong';
import * as ready from './events/ready';
import * as topicUpdate from './events/topicUpdate';
import * as logo from './routes/logo';
import * as status from './routes/status';

const client = new Client();
const app = express();

[ ready, pingPong, topicUpdate ].forEach(it => {
    it.register({ client });
});

[ status, logo ].forEach(it => {
    it.register({ app });
});

if (process.env.DISCORD_BOT_TOKEN)
    void client.login(process.env.DISCORD_BOT_TOKEN);

const port = Number(process.env.PORT ?? 80);
app.listen(port, () => {
    console.debug(`Listening on port ${port}...`);
});
