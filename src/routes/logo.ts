import { Express } from 'express';
import path from 'path';

export const register = ({ app }: { app: Express }): void => {

    const LOGO_FILE = process.env.npm_lifecycle_event != 'dev'
        ? 'logo.png'
        : 'logo-dev.png';

    app.get([ '/', '/favicon.png' ], (_, res) => {
        res.sendFile(path.join(__dirname, `../../assets/${LOGO_FILE}`));
    });

    console.debug('Registered logo route in server.');

};
