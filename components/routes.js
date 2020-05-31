const path = require('path');

module.exports = ({ app, receiver }) => {
    receiver.app.get('/status', async (_, res) => {
        res.sendStatus(200);
    });

    const logo =
        process.env.npm_lifecycle_event != 'dev'
        ? 'logo.png'
        : 'logo-dev.png';
    receiver.app.get(['/', '/logo', '/face'], async (_, res) => {
        res.sendFile(path.join(__dirname, `../static/img/${logo}`));
    });

    receiver.app.get('/install', async (req, res) => {
        let result = await app.client.oauth.v2.access({
            client_id: process.env.SLACK_CLIENT_ID,
            client_secret: process.env.SLACK_CLIENT_SECRET,
            code: req.query.code,
            state: req.query.state
        });

        if (result) {
            res.sendStatus(200);
        }
        else {
            res.sendStatus(400);
        }
    });
};
