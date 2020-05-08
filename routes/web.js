const path = require('path');

module.exports = (receiver) => {

    receiver.app.get('/status', async (_, res) => {
        res.sendStatus(200);
    });

    receiver.app.get(['/', '/logo', '/face'], async (_, res) => {
        res.sendFile(path.join(__dirname, '../static/img/logo.png'));
    });

};
