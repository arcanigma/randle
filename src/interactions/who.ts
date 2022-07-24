import { ApplicationCommandData, ApplicationCommandOptionType, ApplicationCommandType, Client, InteractionType, TextChannel, ThreadChannel, VoiceChannel } from 'discord.js';
import { registerApplicationCommand } from '../library/backend.js';
import { membersOf, names } from '../library/factory.js';
import { blame } from '../library/message.js';
import { shuffleInPlace } from '../library/solve.js';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: ApplicationCommandType.ChatInput,
            name: 'who',
            description: 'List the members of a role', // TODO or channel
            options: [
                {
                    name: 'role',
                    type: ApplicationCommandOptionType.Role,
                    description: 'The @role mention',
                    required: true
                }
            ],
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.type === InteractionType.ApplicationCommand &&
            interaction.commandName === 'who'
        )) return;

        try {
            if (!(
                interaction.channel instanceof TextChannel ||
                interaction.channel instanceof VoiceChannel ||
                interaction.channel instanceof ThreadChannel
            )) throw 'This command can only be used in text channels, text chats in voice channels, and threads.';

            const role_id = interaction.options.get('role')?.value as string;

            if (role_id == interaction.guild?.roles.everyone.id) {
                const { members } = membersOf('@everyone', interaction);

                await interaction.reply({
                    content: `Everyone in ${interaction.channel?.toString()} includes ${names(shuffleInPlace(members))}.`
                });
            }
            else {
                const { name, members } = membersOf(role_id, interaction);

                await interaction.reply({
                    content: `The role ${name} includes ${names(shuffleInPlace(members))}.`
                });
            }
        }
        catch (error: unknown) {
            await interaction.reply({
                embeds: blame({ error, interaction }),
                ephemeral: true
            });
        }
    });

};
