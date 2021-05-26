import { Client } from 'discord.js';
import * as pingPong from './events/pingPong';
import * as ready from './events/ready';
import * as topicUpdate from './events/topicUpdate';

const client = new Client();

[ ready, pingPong, topicUpdate ].forEach(it => {
    it.register({ client });
});

if (process.env.DISCORD_BOT_TOKEN)
    void client.login(process.env.DISCORD_BOT_TOKEN);
