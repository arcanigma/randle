import { Client } from 'discord.js';
import { Express } from 'express';

export const name = 'health';

export function register (app: Express, port: number, client: Client<boolean>): void {
    app.get('/health', (_, res) => {
        let status: number;
        if (client.isReady())
            status = 200;
        else
            status = 503;

        res.sendStatus(status);
    });
}
