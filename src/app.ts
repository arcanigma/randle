import { App, ExpressReceiver } from '@slack/bolt';
import { MongoClient } from 'mongodb';

if (!process.env.SLACK_SIGNING_SECRET)
    throw 'Undefined Slack signing secret.';

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

if (!process.env.SLACK_BOT_TOKEN)
    throw 'Undefined Slack bot token.';

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver
});

if (!process.env.MONGODB_URI)
    throw 'Undefined MongoDB URI.';

const store = MongoClient.connect(
    process.env.MONGODB_URI, {
        useUnifiedTopology: true,
        useNewUrlParser: true
    }
);

const timers: Record<string, NodeJS.Timeout> = {};

export const MAX_TEXT_SIZE = 1000;
export const MAX_VIEW_BLOCKS = 100;
export const MAX_MESSAGE_BLOCKS = 50;
export const MAX_CONTEXT_ELEMENTS = 10;

import * as deck from './deck'; deck.events(app, store);
import * as echo from './echo'; echo.events(app);
import * as home from './home'; home.events(app, store);
import * as macros from './macros/macros'; macros.events(app, store);
import * as polls from './polls/polls'; polls.events(app, store, timers);
import * as roll from './roll'; roll.events(app, store);
import * as routes from './routes'; routes.events(receiver);

(async () => {
    const port = process.env.PORT ?? 3000;
    app.start(port);
    console.log(`Listening on port ${port}...`);
})();
