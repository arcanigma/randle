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
            description: 'Press the panic button (anonymous to the channel, but logged to the server)',
            options: [
                {
                    name: 'about',
                    type: 'STRING',
                    description: 'The reason to panic about',
                    required: false
                }
            ],
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.isCommand() &&
            interaction.commandName === 'panic' &&
            interaction.channel instanceof TextChannel
        )) return;

        try {
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
                        color: 'YELLOW',
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
