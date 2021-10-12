import { ApplicationCommandData, Client, MessageAttachment, TextChannel } from 'discord.js';
import path from 'path';
import { registerApplicationCommand } from '../library/backend';
import { blame } from '../library/message';

const PANIC_BUTTON_IMAGE = 'panic-button.png',
    PANIC_BUTTON_PATH = path.join(__dirname, `../../assets/${PANIC_BUTTON_IMAGE}`);

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: 'CHAT_INPUT',
            name: 'panic',
            description: 'Press the panic button, anonymously',
            options: [
                {
                    name: 'about',
                    type: 'STRING',
                    description: 'What to panic about',
                    required: false
                }
            ],
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'panic') return;

        try {
            if (!(interaction.channel instanceof TextChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const about = interaction.options.get('about')?.value as string | undefined;

            await interaction.reply({
                content: 'You pressed the panic button, anonymously.',
                ephemeral: true
            });

            await interaction.channel.send({
                embeds: [
                    {
                        title: 'Someone pressed the panic button!',
                        color: 'YELLOW',
                        thumbnail: { url: `attachment://${PANIC_BUTTON_IMAGE}` },
                        fields: [
                            {
                                name: 'About...',
                                value: about ?? 'They didn\'t say what.'
                            }
                        ]
                    }
                ],
                files: [
                    new MessageAttachment(PANIC_BUTTON_PATH)
                ]
            });
        }
        catch (error: unknown) {
            await interaction.reply({
                embeds: blame({ error, interaction }),
                ephemeral: true
            });
        }
    });

};
