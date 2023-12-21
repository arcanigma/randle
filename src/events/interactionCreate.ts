import { ClientCommand, CommandInteraction, Events } from 'discord.js';
import { sendBlame } from '../library/messaging.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute (interaction: CommandInteraction): Promise<void> {
    try {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName) as ClientCommand;

            if (command)
                await command.execute(interaction);
            else
                throw `Unrecognized command name ${interaction.commandName}.`;
        }
    }
    catch (error: unknown) {
        await sendBlame(error, interaction);
    }
}
