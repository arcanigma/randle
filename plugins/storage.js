const { MongoClient } = require('mongodb');

module.exports = {

    collection: async (name) => {
        let client = await MongoClient.connect(process.env.MONGODB_URI);
        let coll = await client.db().collection(name);
        return coll;
    }

}
