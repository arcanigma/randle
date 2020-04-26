const { App, ExpressReceiver } = require('@slack/bolt');

const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: receiver
});

app.use(async ({ message, next }) => {
  if (!message.bot_id && !message.bot_profile)
      await next();
});

require('./routes/web.js')(receiver);
require('./routes/distribute.js')(app, receiver);

require('./features/echo.js')(app);
require('./features/macros.js')(app);
require('./features/roll.js')(app);
require('./features/deck.js')(app);
// require('./features/fu.js')(app);

(async () => {
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`Listening on port ${port}...`);
})();
