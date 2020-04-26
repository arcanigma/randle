const { App, ExpressReceiver } = require('@slack/bolt');

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver
});

const { botless } = require('./plugins/listen.js');
app.use(botless);

require('./routes/web.js')(receiver);
require('./routes/distribute.js')(app, receiver);

require('./commands/echo.js')(app);
require('./commands/macros.js')(app);
require('./commands/roll.js')(app);
require('./commands/deck.js')(app);
// require('./commands/fu.js')(app);

(async () => {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`Listening on port ${port}...`);
})();
