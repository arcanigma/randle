import { ApplicationCommandData, ApplicationCommandOptionType, ApplicationCommandType, ButtonComponent, ButtonStyle, Client, Collection, ComponentType, EmbedField, GuildMember, Interaction, InteractionType, Message, MessageActionRowComponentResolvable, MessageOptions, PermissionsBitField, TextChannel, ThreadChannel, UserMention } from 'discord.js';
import emojiRegex from 'emoji-regex';
import { MAX_ACTION_ROWS, MAX_FIELD_NAME, MAX_ROW_COMPONENTS, MAX_THREAD_NAME } from '../constants.js';
import { registerApplicationCommand } from '../library/backend.js';
import { commas, itemize, names, trunc, wss } from '../library/factory.js';
import { blame } from '../library/message.js';
import { shuffleCopy, shuffleInPlace } from '../library/solve.js';

// TODO support private thread polls
// TODO overhaul polls with one drop-down menu per voter?
// TODO modify choices using modal

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
            type: ApplicationCommandType.ChatInput,
            name: 'poll',
            description: 'Create a poll',
            options: [
                {
                    name: 'prompt',
                    type: ApplicationCommandOptionType.String,
                    description: 'A question or statement',
                    required: true
                },
                {
                    name: 'choices',
                    type: ApplicationCommandOptionType.String,
                    description: 'A list of choices, a range size, or an @everyone, @here, or @role mention',
                    required: true
                },
                {
                    name: 'type',
                    type: ApplicationCommandOptionType.String,
                    description: 'The type of poll (sealed by default)',
                    choices: [
                        { name: 'Sealed', value: 'sealed' },
                        { name: 'Unsealed', value: 'unsealed' }
                    ],
                    required: false
                },
            ]
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!(
            interaction.type === InteractionType.ApplicationCommand &&
            interaction.commandName === 'poll'
        )) return;

        try {
            if (!(
                interaction.channel instanceof TextChannel
            )) throw 'This command can only be used in text channels which support threads.';

            if (!canMakePoll(interaction))
                throw "You don't have permission to make a poll in this channel";

            const prompt = interaction.options.get('prompt')?.value as string,
                members = interaction.channel.members,
                choices = itemize(interaction.options.get('choices')?.value as string, interaction).map(it => ({
                    emoji: buildEmoji(it),
                    label: buildChoice(it, members)
                })),
                type = interaction.options.get('type')?.value as string,
                emojis = shuffleCopy(ABSTRACT_EMOJIS.filter(emoji => !choices.some(choice => choice.emoji == emoji)));

            if (choices.length < 1)
                throw 'At least 1 choice is required.';

            const MAX_CHOICES = (MAX_ACTION_ROWS - 1) * MAX_ROW_COMPONENTS;
            if (choices.length > MAX_CHOICES)
                throw `At most ${MAX_CHOICES} choices are allowed.`;

            const reply = await interaction.reply({
                content: type != 'unsealed'
                    ? `${interaction.user.toString()} made a **sealed** poll`
                    : `${interaction.user.toString()} made an **unsealed** poll`,
                fetchReply: true
            });

            const thread = await interaction.channel.threads.create({
                startMessage: reply.id,
                name: trunc(prompt, MAX_THREAD_NAME),
                autoArchiveDuration: DURATION_ONE_DAY
            });

            if (thread.joinable)
                await thread.join();

            const components: MessageOptions['components'] = [];
            while (choices.length > 0) {
                components.push({
                    type: ComponentType.ActionRow,
                    // TODO handle row widths gracefully
                    components: choices.splice(0, MAX_ROW_COMPONENTS).map(it => ({
                        type: ComponentType.Button,
                        emoji: it.emoji ?? (it.emoji = emojis.pop() as string),
                        label: (it.label = trunc(it.label, MAX_CHOICE_LABEL)),
                        customId: type != 'unsealed'
                            ? `vote_s_${it.emoji} ${it.label}`
                            : `vote_u_${it.emoji} ${it.label}`,
                        style: ButtonStyle.Primary
                    }))
                });
            }
            components.push({
                type: ComponentType.ActionRow,
                components: buildPollActionComponents()
            });

            await thread.send({
                content: '**Choices and Actions**',
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !(interaction.customId.startsWith('vote_s_') || interaction.customId.startsWith('vote_u_'))) return;

        try {
            if (!(interaction.channel instanceof ThreadChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            if (!canVote(interaction))
                throw "You don't have permission to vote in this poll";

            const choice = (interaction.component as ButtonComponent).customId?.slice(7);
            if (!choice) return;

            if (interaction.customId.startsWith('vote_s_')) {
                await interaction.reply({
                    content: `${interaction.user.toString()} voted`,
                    components: [
                        {
                            type: ComponentType.ActionRow,
                            components: buildSealedComponents(choice)
                        }
                    ]
                });
            }
            else {
                await interaction.reply({
                    content: `${interaction.user.toString()} voted for **${choice}**`,
                    components: [
                        {
                            type: ComponentType.ActionRow,
                            components: buildUnsealedComponents(choice)
                        }
                    ]
                });
            }

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

        try {
            if (!(interaction.channel instanceof ThreadChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const choice = (interaction.component as ButtonComponent).customId?.slice(7),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (!isAuthor(interaction, whose) && !canModeratePoll(interaction))
                throw "You don't have permission to unseal that vote";

            await interaction.update({
                content: `${whose} voted for **${choice}**`,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: buildUnsealedComponents(choice)
                    }
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith('reseal_')) return;

        try {
            if (!(interaction.channel instanceof ThreadChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const choice = (interaction.component as ButtonComponent).customId?.slice(7),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (!isAuthor(interaction, whose) && !canModeratePoll(interaction))
                throw "You don't have permission to reseal that vote";

            await interaction.update({
                content: `${whose} voted`,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: buildSealedComponents(choice)
                    }
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() || !interaction.customId.startsWith('peek_')) return;

        try {
            if (!(interaction.channel instanceof ThreadChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const choice = (interaction.component as ButtonComponent).customId?.slice(5),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (!isAuthor(interaction, whose) && !canModeratePoll(interaction))
                throw "You don't have permission to peek at that vote";

            await interaction.reply({
                content: `${interaction.user.toString() == whose ? 'You' : whose} voted for **${choice}**`,
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
        if (!interaction.isButton() || !interaction.customId.startsWith('discard_')) return;

        try {
            if (!(interaction.channel instanceof ThreadChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const choice = (interaction.component as ButtonComponent).customId?.slice(8),
                whose = interaction.message.content.match(re_user)?.[0];
            if (!choice || !whose) return;

            if (!isAuthor(interaction, whose) && !canModeratePoll(interaction))
                throw "You don't have permission to discard that vote";

            await interaction.update({
                content: `${whose} discarded a vote`,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: buildDiscardedComponents(choice)
                    }
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

    client.on('interactionCreate', async interaction => {
        if (!interaction.isSelectMenu() || interaction.customId != 'mod_poll') return;

        try {
            if (!(interaction.channel instanceof ThreadChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const action = interaction.values[0];
            if (!action) return;

            if (action == 'check') {
                if (!canVote(interaction))
                    throw "You don't have permission to check this poll";
            }
            else if (!canModeratePoll(interaction))
                throw "You don't have permission to moderate this poll";

            await interaction.update({
                content: interaction.message.content,
                components: interaction.message.components
            });

            const messages = await interaction.channel.messages.fetch();

            if (action == 'check') {
                const results = getVoteResults(messages),
                    voted = getVotedMembers(results),
                    everyone = [...(interaction.channel.parent as TextChannel).members.values()].filter(member => !member.user.bot).map(member => member.user.toString()),
                    unvoted = everyone.filter(member => !voted.includes(member));

                await interaction.followUp({
                    content: 'You checked member participation',
                    embeds: [
                        {
                            title: `Can Vote (${voted.length + unvoted.length})`,
                            fields: [
                                {
                                    name: `Voted (${voted.length})`,
                                    value: names(voted),
                                    inline: true
                                },
                                {
                                    name: `Not Voted (${unvoted.length})`,
                                    value: names(unvoted),
                                    inline: true
                                }
                            ]
                        }
                    ],
                    ephemeral: true
                });
            }
            else if (action == 'peek') {
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
                    const button = message.components[0]?.components[0] as ButtonComponent;
                    if (!button) return;

                    if (button.label == 'Unseal') {
                        const whose = message.content.match(re_user)?.[0],
                            choice = button.customId?.slice(7);
                        if (!whose || !choice) return;

                        void message.edit({
                            content: `${whose} voted for **${choice}**`,
                            components: [
                                {
                                    type: ComponentType.ActionRow,
                                    components: buildUnsealedComponents(choice)
                                }
                            ]
                        });
                    }
                });
            }
            else if (action == 'reseal') {
                messages.filter(message => message.author.bot).forEach(message => {
                    const button = message.components[0]?.components[0] as ButtonComponent;
                    if (!button) return;

                    if (button.label == 'Reseal') {
                        const whose = message.content.match(re_user)?.[0],
                            choice = button.customId?.slice(7);
                        if (!whose || !choice) return;

                        void message.edit({
                            content: `${whose} voted`,
                            components: [
                                {
                                    type: ComponentType.ActionRow,
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
        catch (error: unknown) {
            await interaction.reply({
                embeds: blame({ error, interaction }),
                ephemeral: true
            });
        }
    });

};

function isAuthor (interaction: Interaction, whose: string): boolean {
    return interaction.user.toString() == whose;
}

function canVote (interaction: Interaction): boolean {
    const permissions = (interaction.channel as ThreadChannel).permissionsFor(interaction.user);

    return permissions?.has(PermissionsBitField.Flags.SendMessagesInThreads) ?? false;
}

function canMakePoll (interaction: Interaction): boolean {
    const permissions = (interaction.channel as ThreadChannel).permissionsFor(interaction.user);

    return permissions?.has(PermissionsBitField.Flags.CreatePublicThreads) ?? false;
}

function canModeratePoll (interaction: Interaction): boolean {
    const permissions = (interaction.channel as ThreadChannel).permissionsFor(interaction.user);
    return permissions?.has(PermissionsBitField.Flags.ManageThreads) ?? false;
}

const re_emoji = emojiRegex();
function buildEmoji (choice: string): string | undefined {
    const match = re_emoji.exec(choice);
    if (match) {
        const emoji = match[0],
            codepoints = [...emoji],
            base = codepoints[0]; // TODO support modifiers once API does
        return base;
    }
    else return undefined;
}

const re_user = /<@!?(\d+)>/g,
    re_markdown = /[_~*]+/g;
function buildChoice (choice: string, members: Collection<string, GuildMember>): string {
    return `${wss(choice
        .replaceAll(re_user, (_, id: string) => members.get(id)?.nickname ?? members.get(id)?.user.username ?? 'Unknown')
        .replaceAll(re_emoji, '')
        .replaceAll(re_markdown, '')
    )}`;
}

function buildPollActionComponents (): MessageActionRowComponentResolvable[] {
    return [
        {
            type: ComponentType.SelectMenu,
            customId: 'mod_poll',
            emoji: '🗳️',
            placeholder: 'Select an Action',
            minValues: 1,
            maxValues: 1,
            options: [
                {
                    value: 'check',
                    emoji: '👥',
                    label: 'Check',
                    description: 'Check member participation (ephemeral)'
                },
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
            type: ComponentType.Button,
            customId: `unseal_${choice}`,
            emoji: '📤',
            label: 'Unseal',
            style: ButtonStyle.Secondary
        },
        {
            type: ComponentType.Button,
            customId: `peek_${choice}`,
            emoji: '🔍',
            label: 'Peek',
            style: ButtonStyle.Secondary
        },
        {
            type: ComponentType.Button,
            customId: `discard_${choice}`,
            emoji: '🗑️',
            label: 'Discard',
            style: ButtonStyle.Secondary
        }
    ];
}

function buildUnsealedComponents (choice: string): MessageActionRowComponentResolvable[] {
    return [
        {
            type: ComponentType.Button,
            customId: `reseal_${choice}`,
            emoji: '📥',
            label: 'Reseal',
            style: ButtonStyle.Secondary
        }
    ];
}

function buildDiscardedComponents (choice: string): MessageActionRowComponentResolvable[] {
    return [
        {
            type: ComponentType.Button,
            customId: `reseal_${choice}`,
            emoji: '🗑️',
            label: 'Restore',
            style: ButtonStyle.Secondary
        }
    ];
}

function getVoteResults (messages: Collection<string, Message>): Record<string, Record<UserMention, number>> {
    const results: Record<string, Record<string, number>> = {};
    messages.filter(message => message.author.bot).forEach(message => {
        const firstButton = message?.components[0]?.components[0] as ButtonComponent;
        if (!firstButton) return;

        if (firstButton.label == 'Unseal' || firstButton.label == 'Reseal') {
            const whose = message.content.match(re_user)?.[0] as UserMention,
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

function getVoteTotal (results: Record<string, Record<UserMention, number>>): number {
    let total = 0;
    for (const choice in results) {
        for (const whose in results[choice]) {
            total += results[choice][whose as UserMention];
        }
    }
    return total;
}

function getVotedMembers (results: Record<string, Record<UserMention, number>>): UserMention[] {
    const members: UserMention[] = [];
    for (const choice in results) {
        for (const whose in results[choice]) {
            if (!members.includes(whose as UserMention))
                members.push(whose as UserMention);
        }
    }
    return shuffleInPlace(members);
}

function buildResultFields (results: Record<string, Record<UserMention, number>>, ascribed: boolean): EmbedField[] {
    return Object.keys(results).map(choice => {
        const count = Object.keys(results[choice])
            .map(whose => results[choice][whose as UserMention])
            .reduce((a, b) => a + b, 0);

        return {
            name: trunc(`${choice} (${count})`, MAX_FIELD_NAME),
            value: ascribed
                ? commas(shuffleInPlace(Object.keys(results[choice])).map(whose => {
                    if (results[choice][whose as UserMention] == 1)
                        return whose;
                    else
                        return `${whose} (**${results[choice][whose as UserMention]}**)`;
                }))
                : `by **${Object.keys(results[choice]).length}** members`,
            inline: true,
            count: count
        };
    }).sort((a, b) => (b.count - a.count) || (Math.random() < 0.5 ? -1 : 1)).map(({ name, value, inline }) => ({ name, value, inline }));
}
