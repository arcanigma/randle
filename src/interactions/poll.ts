import { ApplicationCommandData, Client, Collection, EmbedField, GuildMember, Interaction, Message, MessageActionRow, MessageActionRowComponentResolvable, MessageActionRowOptions, MessageButton, Permissions, TextChannel, ThreadChannel } from 'discord.js';
import emojiRegex from 'emoji-regex';
import { MAX_ACTION_ROWS, MAX_FIELD_NAME, MAX_ROW_COMPONENTS, MAX_THREAD_NAME } from '../constants';
import { registerSlashCommand } from '../library/backend';
import { commas, itemize, trunc, wss } from '../library/factory';
import { blame } from '../library/message';
import { shuffleCopy } from '../library/solve';

const MAX_CHOICE_LABEL = 25,
    DURATION_ONE_DAY = 1440;

const ABSTRACT_EMOJIS = [
    '⬛', '⬜', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫',
    '⚫', '⚪', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤',
    '🖤', '🤍', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎'
];

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            name: 'poll',
            description: 'Create a poll',
            options: [
                {
                    name: 'prompt',
                    type: 'STRING',
                    description: 'A question or statement',
                    required: true
                },
                {
                    name: 'choices',
                    type: 'STRING',
                    description: 'A list of choices, a range size, or an @everyone, @here, or @role mention',
                    required: true
                },
            ]
        };

        await registerSlashCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'poll') return;

        if (!(interaction.channel instanceof TextChannel))
            throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

        try {
            const prompt = interaction.options.get('prompt')?.value as string,
                choices = await itemize(interaction.options.get('choices')?.value as string, interaction);

            if (choices.length < 1)
                throw 'At least 1 choice is required.';

            const MAX_CHOICES = (MAX_ACTION_ROWS - 1) * MAX_ROW_COMPONENTS;
            if (choices.length > MAX_CHOICES)
                throw `At most ${MAX_CHOICES} choices are allowed.`;

            if (choices.some(choice => choice.length > MAX_CHOICE_LABEL))
                throw `A choice must be at most ${MAX_CHOICE_LABEL} characters.`;

            const reply = await interaction.reply({
                content: `${interaction.user.toString()} made a poll`,
                fetchReply: true
            });

            const thread = await interaction.channel.threads.create({
                startMessage: reply.id,
                name: trunc(prompt, MAX_THREAD_NAME),
                autoArchiveDuration: DURATION_ONE_DAY
            });

            if (thread.joinable)
                await thread.join();


            const components: MessageActionRowOptions[] = [],
                emojis = shuffleCopy(ABSTRACT_EMOJIS),
                members = interaction.channel.members;
            while (choices.length > 0) {
                components.push({
                    type: 'ACTION_ROW',
                    components: choices.splice(0, MAX_ROW_COMPONENTS).map(it => {
                        const emoji = buildEmoji(it) ?? emojis.pop() as string,
                            choice = buildChoice(it, members);

                        return {
                            type: 'BUTTON',
                            customId: `vote_${emoji} ${choice}`,
                            emoji: emoji,
                            label: trunc(choice, MAX_CHOICE_LABEL),
                            style: 'PRIMARY'
                        };
                    })
                });
            }
            components.push({
                type: 'ACTION_ROW',
                components: buildPollActionComponents()
            });

            await thread.send({
                content: '**Votes and Poll Actions**',
                components: components
            });
        }
        catch (error: unknown) {
            await interaction.reply({
                embeds: blame({ error, interaction }),
                ephemeral: true
            });
        }
    });

    // TODO combine listeners when possible
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith('vote_')) return;

        try {
            const choice = (interaction.component as MessageButton).customId?.slice(5);
            if (!choice) return;

            await interaction.reply({
                content: `${interaction.user.toString()} voted`,
                components: [
                    {
                        type: 'ACTION_ROW',
                        components: buildSealedComponents(choice)
                    }
                ]
            });

            await interaction.followUp({
                content: `You voted for **${choice}**`,
                ephemeral: true
            });
        }
        catch (error: unknown) {
            await interaction.reply({
                embeds: blame({ error, interaction }),
                ephemeral: true
            });
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith('unseal_')) return;

        if (!(interaction.channel instanceof ThreadChannel))
            throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

        try {
            const choice = (interaction.component as MessageButton).customId?.slice(7),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (isAuthor(interaction, whose) || isThreadModerator(interaction)) {
                await interaction.update({
                    content: `${whose} voted for **${choice}**`,
                    components: [
                        {
                            type: 'ACTION_ROW',
                            components: buildUnsealedComponents(choice)
                        }
                    ]
                });
            }
            else {
                await interaction.reply({
                    content: `Only ${whose} or a moderator can unseal their vote.`,
                    ephemeral: true
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith('reseal_')) return;

        if (!(interaction.channel instanceof ThreadChannel))
            throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

        try {
            const choice = (interaction.component as MessageButton).customId?.slice(7),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (isAuthor(interaction, whose) || isThreadModerator(interaction)) {
                await interaction.update({
                    content: `${whose} voted`,
                    components: [
                        {
                            type: 'ACTION_ROW',
                            components: buildSealedComponents(choice)
                        }
                    ]
                });
            }
            else {
                await interaction.reply({
                    content: `Only ${whose} or a moderator can reseal their vote.`,
                    ephemeral: true
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith('peek_')) return;

        if (!(interaction.channel instanceof ThreadChannel))
            throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

        try {
            const choice = (interaction.component as MessageButton).customId?.slice(5),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (isAuthor(interaction, whose) || isThreadModerator(interaction)) {
                await interaction.reply({
                    content: `${interaction.user.toString() == whose ? 'You' : whose} voted for **${choice}**`,
                    ephemeral: true
                });
            }
            else {
                await interaction.reply({
                    content: `Only ${whose} or a moderator can peek at their vote.`,
                    ephemeral: true
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith('discard_')) return;

        if (!(interaction.channel instanceof ThreadChannel))
            throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

        try {
            const choice = (interaction.component as MessageButton).customId?.slice(8),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (isAuthor(interaction, whose) || isThreadModerator(interaction)) {
                await interaction.update({
                    content: `${whose} discarded a vote`,
                    components: [
                        {
                            type: 'ACTION_ROW',
                            components: buildDiscardedComponents(choice)
                        }
                    ]

                });
            }
            else {
                await interaction.reply({
                    content: `Only ${whose} or a moderator can discard their vote.`,
                    ephemeral: true
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isSelectMenu() || interaction.customId != 'mod_poll') return;

        if (!(interaction.channel instanceof ThreadChannel))
            throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

        try {
            const action = interaction.values[0];
            if (!action) return;

            await interaction.update({
                content: interaction.message.content,
                components: interaction.message.components as MessageActionRow[]
            });

            if (isThreadModerator(interaction)) {
                const messages = await interaction.channel.messages.fetch();

                // TODO track by member
                if (action == 'peek') {
                    const results = getVoteResults(messages),
                        total = getVoteTotal(results);

                    await interaction.followUp({
                        content: 'You peeked at all votes',
                        embeds: [{
                            title: `Votes (${total})`,
                            fields: buildResultFields(results, true)
                        }],
                        ephemeral: true
                    });
                }
                else if (action == 'unseal') {
                    messages.filter(message => message.author.bot).forEach(message => {
                        const button = message.components[0]?.components[0] as MessageButton;
                        if (!button) return;

                        if (button.label == 'Unseal') {
                            const whose = message.content.match(re_user)?.[0],
                                choice = button.customId?.slice(7);
                            if (!whose || !choice) return;

                            void message.edit({
                                content: `${whose} voted for **${choice}**`,
                                components: [
                                    {
                                        type: 'ACTION_ROW',
                                        components: buildUnsealedComponents(choice)
                                    }
                                ]
                            });
                        }
                    });
                }
                else if (action == 'reseal') {
                    messages.filter(message => message.author.bot).forEach(message => {
                        const button = message.components[0]?.components[0] as MessageButton;
                        if (!button) return;

                        if (button.label == 'Reseal') {
                            const whose = message.content.match(re_user)?.[0],
                                choice = button.customId?.slice(7);
                            if (!whose || !choice) return;

                            void message.edit({
                                content: `${whose} voted`,
                                components: [
                                    {
                                        type: 'ACTION_ROW',
                                        components: buildSealedComponents(choice)
                                    }
                                ]
                            });
                        }
                    });
                }
                else if (action == 'tally') {
                    const results = getVoteResults(messages),
                        total = getVoteTotal(results);

                    await interaction.followUp({
                        content: `${interaction.user.toString()} tallied all votes`,
                        embeds: [{
                            title: `Votes (${total})`,
                            fields: buildResultFields(results, false)
                        }]
                    });
                }
                else if (action == 'show') {
                    const results = getVoteResults(messages),
                        total = getVoteTotal(results);

                    await interaction.followUp({
                        content: `${interaction.user.toString()} showed all votes`,
                        embeds: [{
                            title: `Votes (${total})`,
                            fields: buildResultFields(results, true)
                        }]
                    });
                }
            }
            else {
                await interaction.reply({
                    content: `Only a moderator can ${action}.`,
                    ephemeral: true
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

function isAuthor (interaction: Interaction, whose?: string): boolean {
    return interaction.user.toString() == whose;
}

function isThreadModerator (interaction: Interaction): boolean {
    const permissions = (interaction.channel as ThreadChannel).permissionsFor(interaction.user);
    return permissions?.has(Permissions.FLAGS.MANAGE_MESSAGES) ?? false;
}

const re_emoji = emojiRegex();
function buildEmoji (choice: string): string | undefined {
    return re_emoji.exec(choice)?.[0];
}

const re_user = /<@!?(\d+)>/g,
    re_markdown = /[_~*]+/g;
function buildChoice (choice: string, members: Collection<string, GuildMember>): string {
    return `${wss(choice
        .replaceAll(re_user, (_, id) => members.get(id)?.nickname ?? members.get(id)?.user.username ?? 'Unknown')
        .replaceAll(re_emoji, '')
        .replaceAll(re_markdown, '')
    )}`;
}

function buildPollActionComponents (): MessageActionRowComponentResolvable[] {
    return [
        {
            type: 'SELECT_MENU',
            customId: 'mod_poll',
            emoji: '🗳️',
            placeholder: 'Select a Poll Action',
            minValues: 1,
            maxValues: 1,
            options: [
                // {
                //     value: 'track',
                //     emoji: '🧾',
                //     label: 'Track',
                //     description: 'Track who voted (ephemeral, any member)'
                // },
                {
                    value: 'peek',
                    emoji: '🔍',
                    label: 'Peek',
                    description: 'Peek at all votes (ephemeral, moderator only)'
                },
                {
                    value: 'unseal',
                    emoji: '📤',
                    label: 'Unseal',
                    description: 'Unseal any sealed votes (moderator only)'
                },
                {
                    value: 'reseal',
                    emoji: '📥',
                    label: 'Reseal',
                    description: 'Reseal any unsealed votes (moderator only)'
                },
                {
                    value: 'tally',
                    emoji: '🧮',
                    label: 'Tally',
                    description: 'Tally vote counts (moderator only)'
                },
                {
                    value: 'show',
                    emoji: '📊',
                    label: 'Show',
                    description: 'Show all votes (moderator only)'
                }
            ]
        }
    ];
}

function buildSealedComponents (choice: string): MessageActionRowComponentResolvable[] {
    return [
        {
            type: 'BUTTON',
            customId: `unseal_${choice}`,
            emoji: '📤',
            label: 'Unseal',
            style: 'SECONDARY'
        },
        {
            type: 'BUTTON',
            customId: `peek_${choice}`,
            emoji: '🔍',
            label: 'Peek',
            style: 'SECONDARY'
        },
        {
            type: 'BUTTON',
            customId: `discard_${choice}`,
            emoji: '🗑️',
            label: 'Discard',
            style: 'SECONDARY'
        }
    ];
}



function buildUnsealedComponents (choice: string): MessageActionRowComponentResolvable[] {
    return [
        {
            type: 'BUTTON',
            customId: `reseal_${choice}`,
            emoji: '📥',
            label: 'Reseal',
            style: 'SECONDARY'
        }
    ];
}

function buildDiscardedComponents (choice: string): MessageActionRowComponentResolvable[] {
    return [
        {
            type: 'BUTTON',
            customId: `reseal_${choice}`,
            emoji: '🗑️',
            label: 'Restore',
            style: 'SECONDARY'
        }
    ];
}

function getVoteResults (messages: Collection<string, Message>): Record<string, Record<string, number>> {
    const results: Record<string, Record<string, number>> = {};
    messages.filter(message => message.author.bot).forEach(message => {
        const firstButton = message?.components[0]?.components[0] as MessageButton;
        if (!firstButton) return;

        if (firstButton.label == 'Unseal' || firstButton.label == 'Reseal') {
            const whose = message.content.match(re_user)?.[0],
                choice = firstButton.customId?.slice(7);
            if (!whose || !choice) return;

            if (results[choice])
                if (results[choice][whose])
                    results[choice][whose]++;
                else
                    results[choice][whose] = 1;
            else
                results[choice] = { [whose]: 1 } ;
        }
    });
    return results;
}

function getVoteTotal (results: Record<string, Record<string, number>>): number {
    let total = 0;
    for (const choice in results) {
        for (const whose in results[choice]) {
            total += results[choice][whose];
        }
    }
    return total;
}

function buildResultFields (results: Record<string, Record<string, number>>, ascribed: boolean): EmbedField[] {
    return Object.keys(results).map(choice => {
        const count = Object.keys(results[choice])
            .map(whose => results[choice][whose])
            .reduce((a, b) => a + b, 0);

        return {
            name: trunc(`${choice} (${count})`, MAX_FIELD_NAME),
            value: ascribed
                ? commas(Object.keys(results[choice]).map(whose => {
                    if (results[choice][whose] == 1)
                        return whose;
                    else
                        return `${whose} (**${results[choice][whose]}**)`;
                }))
                : `by **${Object.keys(results[choice]).length}** members`,
            inline: true,
            count: count
        };
    }).sort((a, b) => (b.count - a.count) || (Math.random() < 0.5 ? -1 : 1)).map(({ name, value, inline }) => ({ name, value, inline }));
}
