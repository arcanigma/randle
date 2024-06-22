import { ApplicationCommandOptionType, ApplicationCommandType, AttachmentBuilder, ChatInputApplicationCommandData, Colors, CommandInteraction } from 'discord.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const data: ChatInputApplicationCommandData = {
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
};

const __dirname = dirname(fileURLToPath(import.meta.url));

const PANIC_BUTTON_IMAGE = 'panic-button.png',
    PANIC_BUTTON_PATH = join(__dirname, `../../public/${PANIC_BUTTON_IMAGE}`);

export async function execute (interaction: CommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased())
        throw 'This command can only be used in text-based channels.';

    if (interaction.channel.isDMBased())
        throw "This command can't be used in direct messages.";

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
