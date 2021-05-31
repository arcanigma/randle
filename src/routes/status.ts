import { Express } from 'express';

export const register = ({ app }: { app: Express }): void => {

    app.get('/status', (_, res) => {
        res.sendStatus(200);
    });

    console.debug('Registered status route.');

};
