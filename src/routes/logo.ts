import { Express } from 'express';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_FILE = process.env.npm_lifecycle_event != 'dev'
    ? 'logo.png'
    : 'logo-dev.png';

export const name = 'logo';

export function register (app: Express): void {
    app.get([ '/', '/favicon.png', '/logo' ], (_, res) => {
        res.sendFile(join(__dirname, `../../public/${LOGO_FILE}`));
    });
}
