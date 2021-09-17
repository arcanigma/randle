import { CommandInteraction, EmbedField, Interaction, MessageEmbed } from 'discord.js';
import { MAX_EMBED_FIELDS, MAX_FIELD_NAME, MAX_FIELD_VALUE, MAX_MESSAGE_EMBEDS } from '../constants';
import { trunc } from './factory';

export function blame ({ error, interaction }: { error: unknown; interaction: Interaction }): MessageEmbed[] {
    if (error instanceof Error) {
        console.error({ error });
        return <MessageEmbed[]>[
            {
                title: '🛑 Error',
                description: 'Your action caused an error.',
                fields: [
                    {
                        name: trunc(error.name || 'Error', MAX_FIELD_NAME),
                        value: trunc(error.message || 'unspecified', MAX_FIELD_VALUE),
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
                    ... ( interaction instanceof CommandInteraction
                        ? [
                            {
                                name: 'Command',
                                value: trunc(interaction.commandName || 'unknown', MAX_FIELD_VALUE),
                                inline: true
                            },
                            {
                                name: 'Options',
                                value: trunc(JSON.stringify(interaction.options.data.map(({ name, value }) => ({ name, value }))) || 'none', MAX_FIELD_VALUE),
                                inline: true
                            }
                        ]
                        : []
                    )
                ]
            }
        ];
    }
    else {
        console.warn({ error });
        return <MessageEmbed[]>[
            {
                title: '⚠️ Warning',
                description: 'Your action caused a warning.',
                fields: [
                    {
                        name: 'User Warning',
                        value: trunc(error as string, MAX_FIELD_VALUE),
                        inline: true
                    },
                ]
            }
        ];

    }
}

export function truncEmbeds (embeds: MessageEmbed[], label: string): MessageEmbed[] {
    if (embeds.length >= MAX_MESSAGE_EMBEDS) {
        embeds = embeds.slice(0, MAX_MESSAGE_EMBEDS - 1);
        embeds[MAX_MESSAGE_EMBEDS - 1] = <MessageEmbed> {
            title: '⚠️ Warning',
            description: `Too many ${label} to show (limit of ${MAX_MESSAGE_EMBEDS}).`
        };
    }
    return embeds;
}

export function truncFields (fields: EmbedField[], label: string): EmbedField[] {
    if (fields.length >= MAX_EMBED_FIELDS) {
        fields = fields.slice(0, MAX_EMBED_FIELDS - 1);
        fields[MAX_EMBED_FIELDS - 1] = <EmbedField> {
            name: '⚠️ Warning',
            value: `Too many ${label} to show (limit of ${MAX_EMBED_FIELDS}).`,
            inline: false
        };
    }
    return fields;
}
