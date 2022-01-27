import { ApplicationCommandData, Client, TextChannel } from 'discord.js';
import { registerApplicationCommand } from '../library/backend';
import { commas, membersOf } from '../library/factory';
import { blame } from '../library/message';
import { shuffleInPlace } from '../library/solve';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: 'CHAT_INPUT',
            name: 'who',
            description: 'List the members of a role', // TODO or channel
            options: [
                {
                    name: 'role',
                    type: 'ROLE',
                    description: 'The @role mention',
                    required: true
                }
            ],
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.isCommand() &&
            interaction.commandName === 'who' &&
            interaction.channel instanceof TextChannel
        )) return;

        try {
            const role_id = interaction.options.get('role')?.value as string;

            if (role_id == interaction.guild?.roles.everyone.id) {
                const { members } = membersOf('@everyone', interaction);

                await interaction.reply({
                    content: `Everyone in ${interaction.channel?.toString()} includes ${commas(shuffleInPlace(members))}.`
                });
            }
            else {
                const { name, members } = membersOf(role_id, interaction);

                await interaction.reply({
                    content: `The role ${name} includes ${commas(shuffleInPlace(members))}.`
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
