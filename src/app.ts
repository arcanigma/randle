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

export const MAX_TEXT_SIZE = 1000;
export const MAX_VIEW_BLOCKS = 100;
export const MAX_MESSAGE_BLOCKS = 50;
export const MAX_CONTEXT_ELEMENTS = 10;

import deck from './components/deck'; deck(app);
import echo from './components/echo'; echo (app);
import home from './components/home'; home(app, store);
import macros from './components/macros'; macros(app, store);
import polls from './components/polls'; polls(app, store);
import roll from './components/roll'; roll(app, store);
import routes from './components/routes'; routes(app, receiver);

(async () => {
    const port = process.env.PORT ?? 3000;
    app.start(port);
    console.log(`Listening on port ${port}...`);
})();
