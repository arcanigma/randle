import { App, ExpressReceiver } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import * as debug from './debug';
import * as deck from './deck/deck';
import * as home from './home';
import * as macros from './macros/macros';
import * as polls from './polls/polls';
import * as roll from './roll';
import * as routes from './routes';

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

[ deck, debug, home, macros, polls, roll, routes ].forEach(it => {
    it.register({ app, receiver, store, timers });
});

void (async () => {
    const port = process.env.PORT ?? 80;
    await app.start(port);
    console.debug(`Listening on port ${port}...`);
})();
