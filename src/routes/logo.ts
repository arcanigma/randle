import { Express } from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function register ({ app }: { app: Express }): void {
    const LOGO_FILE = process.env.npm_lifecycle_event != 'dev'
        ? 'logo.png'
        : 'logo-dev.png';

    app.get([ '/', '/favicon.png' ], (_, res) => {
        res.sendFile(join(__dirname, `../../public/${LOGO_FILE}`));
    });

    console.debug('Registered <logo> route in server.');
}
