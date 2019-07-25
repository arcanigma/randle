const CONFIG = require('../config'),
      { MongoDbStorage } = require('botbuilder-storage-mongodb');

module.exports = function(botkit) {

    return {
        name: 'Database States',

        init: function(controller) {
            controller.addPluginExtension('states', this);
        },

        user: new MongoDbStorage({
            url: process.env.MONGODB_URI,
            database: CONFIG.DATABASE,
            collection: CONFIG.USER_STATE
        })
    };

};
