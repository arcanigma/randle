import { Collection } from 'discord.js';

declare module 'discord.js' {
    export interface Client {
        commands: Collection<string, ClientCommand>;
    }

    export interface ClientEvent {
        name: keyof ClientEvents;
        once: boolean;
        execute: Parameters<Client['on']>[1] & Parameters<Client['once']>[1];
    }

    export interface ClientCommand {
        data: ApplicationCommandData;
        execute: (interaction: CommandInteraction) => Promise<void>;
    }

    export interface ClientRoute {
        name: keyof ClientEvents;
        once: boolean;
        register: (app: unknown, port?: number, client?: Client<boolean>) => void;
    }
}
