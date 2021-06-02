import { CommandInteraction, MessageEmbed } from 'discord.js';
import { MAX_FIELD_NAME, MAX_FIELD_VALUE } from '../constants';
import { trunc } from './factory';

export function blame ({ error, interaction }: {
    error: unknown;
    interaction: CommandInteraction;
}): MessageEmbed[] {
    if (error instanceof Error) {
        console.error({ error });
        return <MessageEmbed[]>[
            {
                title: '⚠️ Warning',
                description: 'Your message caused an error. Please report these details to the developer.',
                fields: [
                    {
                        name: trunc(error.name, MAX_FIELD_NAME),
                        value: trunc(error.message, MAX_FIELD_VALUE),
                        inline: true
                    },
                    {
                        name: 'Source',
                        value: trunc(error.stack?.match(/\w+.ts:\d+:\d+/g)?.[0] ?? 'unknown', MAX_FIELD_VALUE),
                        inline: true
                    },
                    {
                        name: 'Channel',
                        value: trunc(`${interaction.channel?.toString() ?? 'unknown'}`, MAX_FIELD_VALUE),
                        inline: true
                    },
                    {
                        name: 'Command',
                        value: trunc(interaction.commandName, MAX_FIELD_VALUE),
                        inline: true
                    },
                    {
                        name: 'Options',
                        value: trunc(JSON.stringify(interaction.options), MAX_FIELD_VALUE),
                        inline: true
                    }
                ]
            }
        ];
    }
    else {
        console.warn({ error });
        return <MessageEmbed[]>[
            {
                title: '⚠️ Warning',
                description: 'Your command has a problem. Please correct the problem before trying again.',
                fields: [
                    {
                        name: 'User Error',
                        value: trunc(error as string, MAX_FIELD_VALUE),
                        inline: true
                    },
                ]
            }
        ];

    }
}
