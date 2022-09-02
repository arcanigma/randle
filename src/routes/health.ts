import { Express } from 'express';

export function register ({ app }: { app: Express }): void {
    app.get('/health', (_, res) => {
        res.sendStatus(200);
    });

    console.debug('Registered <health> route in server.');
}
