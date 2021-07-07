import { ApplicationCommandData, Client, Snowflake, TextChannel } from 'discord.js';
import { registerSlashCommand } from '../library/backend';
import { names } from '../library/factory';
import { blame } from '../library/message';
import { shuffleInPlace } from '../library/solve';

export const dev = true;

export const register = ({ client }: { client: Client }): void => {
    if (process.env.NODE_ENV != 'development') return;

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            name: 'who',
            description: 'List the members of an opt-in/opt-out role',
            options: [
                {
                    name: 'role',
                    type: 'ROLE',
                    description: 'An @role mention',
                    required: true
                }
            ],
        };

        await registerSlashCommand(slash, client);
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'who') return;

        if (!(interaction.channel instanceof TextChannel))
            throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

        try {
            const role_id = interaction.options.get('role')?.value as string;

            const role = await interaction.guild?.roles.fetch(role_id as Snowflake),
                everyone = role?.name == '@everyone';

            if (!role || (!everyone && !role.mentionable))
                throw `Unmentionable role ${role?.toString() ?? `<${role_id}>`}.`;

            let members = [...role.members.values()];

            if (!everyone && !members.some(it => it.user.id == interaction.applicationId))
                throw `Missing bot in mentionable role ${role.toString()}.`;

            members = shuffleInPlace(members.filter(it => !it.user.bot));

            await interaction.reply({
                content: `The role ${role.toString()} includes ${names(members)}.`
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
