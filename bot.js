const CONFIG = require('./config');

const { Botkit } = require('botkit'),
      { SlackAdapter, SlackEventMiddleware, SlackMessageTypeMiddleware  } = require('botbuilder-adapter-slack'),
      { MongoDbStorage } = require('botbuilder-storage-mongodb');

let adapter = new SlackAdapter({
    botToken: process.env.SLACK_BOT_TOKEN,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET
});

let controller = new Botkit({
    adapter: adapter,
    // storage: new MongoDbStorage({
    //     url: process.env.MONGODB_URI,
    //     database: CONFIG.DATABASE,
    //     collection: CONFIG.CONVERSATION_STATE
    // })
});

adapter.use(new SlackEventMiddleware());
adapter.use(new SlackMessageTypeMiddleware());

controller.usePlugin(require('./plugins/handler'));
controller.usePlugin(require('./plugins/states'));

controller.ready(() => {
    controller.loadModules(__dirname + '/features');
});
