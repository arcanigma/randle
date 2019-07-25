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
    webhook_uri: '/api/messages',
    adapter: adapter,
    storage: undefined /* new MongoDbStorage({
        url : process.env.MONGODB_URI,
        database: 'randle',
        collection: 'colletion'
    }) */ // TODO: enable state storage
});

adapter.use(new SlackEventMiddleware());
adapter.use(new SlackMessageTypeMiddleware());

controller.usePlugin(require('./plugins/handler'));

controller.ready(() => {
    controller.loadModules(__dirname + '/features');
});
