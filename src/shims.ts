import { ApplicationCommandManager } from 'discord.js';

export type ApplicationCommandData = Parameters<ApplicationCommandManager['create']>[0];
