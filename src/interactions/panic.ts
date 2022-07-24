import { ApplicationCommandOptionType, ApplicationCommandType, AttachmentBuilder, CacheType, Client, Colors, Interaction, InteractionType, TextChannel, ThreadChannel, VoiceChannel } from 'discord.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createApplicationCommand } from '../library/backend.js';
import { blame } from '../library/message.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PANIC_BUTTON_IMAGE = 'panic-button.png',
    PANIC_BUTTON_PATH = join(__dirname, `../../public/${PANIC_BUTTON_IMAGE}`);

export function register ({ client }: { client: Client }): void {
    createApplicationCommand(client, {
        type: ApplicationCommandType.ChatInput,
        name: 'panic',
        description: 'Press the panic button (anonymous to the channel, but logged to the server)',
        options: [
            {
                name: 'about',
                type: ApplicationCommandOptionType.String,
                description: 'The reason to panic about',
                required: false
            }
        ],
    });
}

export async function execute ({ interaction }: { interaction: Interaction<CacheType>}): Promise<boolean> {
    if (!(
        interaction.type === InteractionType.ApplicationCommand &&
        interaction.commandName === 'panic'
    )) return false;

    try {
        if (!(
            interaction.channel instanceof TextChannel ||
            interaction.channel instanceof VoiceChannel ||
            interaction.channel instanceof ThreadChannel
        )) throw 'This command can only be used in text channels, text chats in voice channels, and threads.';

        const about = interaction.options.get('about')?.value as string | undefined;

        console.debug(interaction);

        await interaction.reply({
            content: 'You pressed the panic button.',
            ephemeral: true
        });

        await interaction.channel.send({
            embeds: [
                {
                    title: 'A member in the channel pressed the panic button!',
                    color: Colors.Yellow,
                    thumbnail: { url: `attachment://${PANIC_BUTTON_IMAGE}` },
                    fields: [
                        {
                            name: 'About...',
                            value: about ?? 'The member didn\'t give a reason.'
                        }
                    ]
                }
            ],
            files: [
                new AttachmentBuilder(PANIC_BUTTON_PATH)
            ]
        });
    }
    catch (error: unknown) {
        await interaction.reply({
            embeds: blame({ error, interaction }),
            ephemeral: true
        });
    }

    return true;
}
