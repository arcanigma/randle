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

require('./components/deck.js')({ app });
require('./components/echo.js')({ app });
require('./components/home.js')({ app, store });
require('./components/macros.js')({ app, store });
require('./components/polls.js')({ app, store });
require('./components/roll.js')({ app, store });
require('./components/routes.js')({ app, receiver });

(async () => {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`Listening on port ${port}...`);
})();
