import { ClientCommand, Events, Interaction } from 'discord.js';
import { sendBlame } from '../library/messages.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute (interaction: Interaction): Promise<void> {
    try {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName) as ClientCommand;

            if (command) {
                await command.execute(interaction);
                return;
            }
            else {
                throw `Unrecognized command name ${interaction.commandName}.`;
            }
        }
        else if (interaction.isButton()) {
            for (const [ commandName, command ] of interaction.client.commands.entries()) {
                if (interaction.customId.startsWith(`${commandName}_`)) {
                    await command.proceed(interaction);
                    return;
                }
            }
            throw `Unrecognized component identifier ${interaction.customId}.`;
        }
    }
    catch (error: unknown) {
        await sendBlame(error, interaction);
    }
}
