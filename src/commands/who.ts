import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputApplicationCommandData, CommandInteraction, channelMention } from 'discord.js';
import { membersOf, names } from '../library/factory.js';
import { shuffleInPlace } from '../library/solve.js';

export const data: ChatInputApplicationCommandData = {
    type: ApplicationCommandType.ChatInput,
    name: 'who',
    description: 'List the members of a role', // TODO or channel (mentionable)
    options: [
        {
            name: 'role',
            type: ApplicationCommandOptionType.Role,
            description: 'The @role mention',
            required: true
        }
    ],
};

export async function execute (interaction: CommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased())
        throw 'This command can only be used in text-based channels.';

    if (interaction.channel.isDMBased())
        throw "This command can't be used in direct messages.";

    const role_id = interaction.options.get('role')?.value as string;

    if (role_id == interaction.guild?.roles.everyone.id) {
        const { members } = membersOf('@everyone', interaction);

        await interaction.reply({
            content: `Everyone in ${channelMention(interaction.channel.id)} includes ${names(shuffleInPlace(members))}.`
        });
    }
    else {
        const { name, members } = membersOf(role_id, interaction);

        await interaction.reply({
            content: `The role ${name} includes ${names(shuffleInPlace(members))}.`
        });
    }
}
