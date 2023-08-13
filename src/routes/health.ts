import { Client } from 'discord.js';
import { Express } from 'express';

export function register ({ app, port, client }: { app: Express; port: number; client: Client<boolean> }): void {
    app.get('/health', (_, res) => {
        let status: number;
        if (client.isReady())
            status = 200;
        else
            status = 503;

        res.sendStatus(status);
    });

    console.debug(`Registered <health> route on port <${port}>.`);
}
