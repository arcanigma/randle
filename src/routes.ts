import { ExpressReceiver } from '@slack/bolt';
import path from 'path';

export const events = (receiver: ExpressReceiver): void => {
    const LOGO_FILE = process.env.npm_lifecycle_event != 'dev'
        ? 'logo.png'
        : 'logo-dev.png';

    // TODO proper support for favicon
    receiver.router.get(['/', '/favicon.png'], (_, res) => {
        res.sendFile(path.join(__dirname, `../assets/${LOGO_FILE}`));
    });

    receiver.router.get('/status', (_, res) => {
        res.sendStatus(200);
    });

    // receiver.app.get('/install', async (req, res) => {
    //     const result = await app.client.oauth.v2.access({
    //         client_id: process.env.SLACK_CLIENT_ID,
    //         client_secret: process.env.SLACK_CLIENT_SECRET,
    //         code: req.query.code as string,
    //         state: req.query.state
    //     });

    //     res.sendStatus(result ? 200 : 400);
    // });
};
