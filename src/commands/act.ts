import { ActivityType, ApplicationCommandOptionType, ApplicationCommandType, ChatInputApplicationCommandData, CommandInteraction, MessageFlags } from 'discord.js';
import { MAX_CUSTOM_STATUS } from '../library/constants.js';

export const READY_ACTIVITY = '🎲 Ready to Roll';
export const MAINTENANCE_ACTIVITY = '🏗️ Down for Maintenance';
export const DEFAULT_ACTIVITY = process.env.MAINTENANCE_MODE !== 'true'
    ? READY_ACTIVITY
    : MAINTENANCE_ACTIVITY;

export const data: ChatInputApplicationCommandData = {
    type: ApplicationCommandType.ChatInput,
    name: 'act',
    description: "Set the bot's activity",
    options: [
        {
            name: 'input',
            type: ApplicationCommandOptionType.String,
            description: 'A custom activity, reset, or clear',
            required: true,
            max_length: MAX_CUSTOM_STATUS
        }
    ]
};

export async function execute (interaction: CommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased())
        throw 'This command can only be used in text-based channels.';

    const activity = interaction.options.get('input')?.value as string;

    if (activity == 'reset') {
        interaction.client.user.setPresence({
            activities: [{ name: DEFAULT_ACTIVITY, type: ActivityType.Custom }]
        });

        await interaction.reply({
            content: 'Reset bot activity',
            flags: MessageFlags.Ephemeral
        });
    }
    else if (activity == 'clear') {
        interaction.client.user.setPresence({
            activities: []
        });

        await interaction.reply({
            content: 'Cleared bot activity',
            flags: MessageFlags.Ephemeral
        });
    }
    else {
        interaction.client.user.setPresence({
            activities: [{ name: activity, type: ActivityType.Custom }]
        });

        await interaction.reply({
            content: 'Set bot activity',
            flags: MessageFlags.Ephemeral
        });
    }
}
