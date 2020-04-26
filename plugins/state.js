const { MongoClient } = require('mongodb');

const client = async () => {
    return MongoClient.connect(
        process.env.MONGODB_URI, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        }
    );
};

const collection = async (name) => {
    return (await client()).db().collection(name);
};

module.exports = {
    client,
    collection
};
