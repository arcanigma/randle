import { ApplicationCommandData, Client, TextChannel } from 'discord.js';
import { registerApplicationCommand } from '../library/backend';
import { names } from '../library/factory';
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
        if (!interaction.isCommand() || interaction.commandName !== 'who') return;

        try {
            if (!(interaction.channel instanceof TextChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const role_id = interaction.options.get('role')?.value as string;

            if (role_id == interaction.guild?.roles.everyone.id) {
                const members = shuffleInPlace([...interaction.channel.members.values()]);

                await interaction.reply({
                    content: `Everyone in ${interaction.channel?.toString()} includes ${names(members)}.`
                });
            }
            else {
                const role = await interaction.guild?.roles.fetch(role_id);
                if (!role)
                    throw `Unsupported role <${role_id}>.`;

                const members = shuffleInPlace([...role.members.values()]);

                await interaction.reply({
                    content: `The role ${role.toString()} includes ${names(members)}.`
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
