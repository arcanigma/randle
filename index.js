const { App, ExpressReceiver } = require('@slack/bolt'),
      { MongoClient } = require('mongodb');

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver
});

const store = MongoClient.connect(
    process.env.MONGODB_URI, {
        useUnifiedTopology: true,
        useNewUrlParser: true
    }
);

require('./routes/web.js')(receiver);
require('./routes/distribute.js')(app, receiver);

// TODO refactor each with one function per file
require('./events/home.js')(app, store);
require('./events/macros.js')(app, store);
require('./events/polls.js')(app, store);

require('./commands/echo.js')(app);
require('./commands/roll.js')(app, store);
require('./commands/deck.js')(app);

(async () => {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`Listening on port ${port}...`);
})();
