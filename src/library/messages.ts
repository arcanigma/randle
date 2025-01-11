import { BaseInteraction, CommandInteraction, Embed, EmbedField, MessageFlags } from 'discord.js';
import { MAX_EMBED_FIELDS, MAX_FIELD_NAME, MAX_FIELD_VALUE, MAX_MESSAGE_EMBEDS } from './constants.js';
import { trunc } from './texts.js';

export async function sendBlame (payload: unknown, interaction?: BaseInteraction): Promise<void> {
    if (payload instanceof Error) {
        console.error(payload);
    }
    else {
        console.warn(payload);
    }

    if (interaction?.isRepliable()) {
        let embeds: Embed[];
        if (payload instanceof Error) {
            embeds = [
                {
                    title: '🛑 Error',
                    description: 'Your action caused an error.',
                    fields: [
                        {
                            name: trunc(payload.name || 'Error', MAX_FIELD_NAME),
                            value: trunc(payload.message || 'unspecified', MAX_FIELD_VALUE),
                            inline: true
                        },
                        {
                            name: 'Source',
                            value: trunc(payload.stack?.match(/\w+.ts:\d+:\d+/g)?.[0] ?? 'unknown', MAX_FIELD_VALUE),
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
            ] as Embed[];
        }
        else {
            embeds = [
                {
                    title: '⚠️ Warning',
                    description: 'Your action caused a warning.',
                    fields: [
                        {
                            name: 'User Warning',
                            value: trunc(payload as string, MAX_FIELD_VALUE),
                            inline: true
                        },
                    ]
                }
            ] as Embed[];
        }

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                embeds: embeds,
                flags: MessageFlags.Ephemeral
            });
        }
        else {
            await interaction.reply({
                embeds: embeds,
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

export function truncEmbeds (embeds: Embed[], label: string): Embed[] {
    if (embeds.length >= MAX_MESSAGE_EMBEDS) {
        embeds = embeds.slice(0, MAX_MESSAGE_EMBEDS - 1);
        embeds[MAX_MESSAGE_EMBEDS - 1] = {
            title: '⚠️ Warning',
            description: `Too many ${label} to show (limit of ${MAX_MESSAGE_EMBEDS}).`
        } as Embed;
    }
    return embeds;
}

export function truncFields (fields: EmbedField[], overflow: string): EmbedField[] {
    if (fields.length >= MAX_EMBED_FIELDS) {
        fields = fields.slice(0, MAX_EMBED_FIELDS - 1);
        fields[MAX_EMBED_FIELDS - 1] = {
            name: '⚠️ Warning',
            value: `Too many ${overflow} to show (limit of ${MAX_EMBED_FIELDS}).`,
            inline: false
        } as EmbedField;
    }
    return fields;
}
