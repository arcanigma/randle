import { ApplicationCommandType, ButtonStyle, Colors, ComponentType, Embed, EmbedField, GuildMember, MessageApplicationCommandData, MessageComponentInteraction, MessageContextMenuCommandInteraction, channelMention } from 'discord.js';
import got from 'got';
import JSON5 from 'json5';
import { MAX_EMBED_DESCRIPTION, MAX_FIELD_NAME, MAX_FIELD_VALUE } from '../constants.js';
import { commas, names, trunc } from '../library/factory.js';
import { truncEmbeds, truncFields } from '../library/messaging.js';
import { Script } from '../library/script.js';
import { choose, conditionOf, deckOf, listOf, matchOf, optionOf, shuffleInPlace, valueOf } from '../library/solve.js';

// TODO prompts to select moderators, includes, or excludes

export const MAX_IMPORTS = 3;
export const PROMPT_TIMEOUT = 30_000;

export const data: MessageApplicationCommandData = {
    type: ApplicationCommandType.Message,
    name: 'Play Script'
};

const re_highlight = /^```(json\b)?|```$/g;
export async function execute (interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased())
        throw 'This command can only be used in text-based channels.';

    if (interaction.channel.isDMBased())
        throw "This command can't be used in direct messages.";

    if (interaction.channel.isThread())
        throw "This command can't be used in threads.";

    await interaction.reply({
        content: 'Please wait, building your script...',
        components: [],
        ephemeral: true
    });

    let script: Script;
    try {
        const raw = interaction.targetMessage.content.replace(re_highlight, '').trim();
        script = JSON5.parse(raw);
    }
    catch (error) {
        throw 'Unable to parse JSON in message.';
    }

    if (script.requireModerator !== undefined)
        script.requireModerator = optionOf(script.requireModerator, script.setup);

    if (script.minMembers !== undefined)
        script.minMembers = valueOf(script.minMembers, script.setup);

    if (script.maxMembers !== undefined)
        script.maxMembers = valueOf(script.maxMembers, script.setup);

    if (!script.setup)
        script.setup = {};

    if (!script.rules)
        script.rules = [];

    if (script.import) {
        const imports = listOf(script.import);
        delete script.import;

        if (imports.length > MAX_IMPORTS)
            throw `Too many imports in script (limit of ${MAX_IMPORTS}).`;

        for (const i_url of imports) {
            let raw: string;
            try {
                raw = (await got.get(i_url).text()).trim();
            }
            catch (error) {
                throw `Web error ${JSON.stringify(error)} at \`${i_url}\` address.`;
            }

            let i_script: Script;
            try {
                i_script = JSON5.parse(raw);
            }
            catch (error) {
                throw `Unable to parse JSON at \`${i_url}\` address.`;
            }

            if (i_script.event !== undefined)
                script.event = script.event !== undefined
                    ? `${script.event} \u2022 ${i_script.event}`
                    : i_script.event;

            if (i_script.requireModerator !== undefined) {
                const flag = optionOf(i_script.requireModerator, script.setup);
                if (flag != script.requireModerator)
                    throw `Moderator requirements must match in script and \`${i_url}\` import.`;
            }

            if (i_script.minMembers !== undefined) {
                const min = valueOf(i_script.minMembers, script.setup);
                if (!script.minMembers || min < script.minMembers)
                    script.minMembers = min;
            }

            if (i_script.maxMembers !== undefined) {
                const max = valueOf(i_script.maxMembers, script.setup);
                if (!script.maxMembers || max > script.maxMembers)
                    script.maxMembers = max;
            }

            if (i_script.setup)
                script.setup = Object.assign(script.setup ?? {}, i_script.setup);

            if (i_script.rules)
                script.rules.push(...i_script.rules);

            if (i_script.import)
                throw `Forbidden nested import in \`${i_url}\` import.`;
        }
    }

    const collector_filter = (ia: MessageComponentInteraction) => {
        ia.deferUpdate();
        return ia.user.id === interaction.user.id;
    };

    const prompt_message = await interaction.editReply({
        content: 'Only preview the script, or ready to play it live?',
        components: [
            {
                type: 1,
                components: [
                    { type: ComponentType.Button, style: ButtonStyle.Success, label: 'Preview', custom_id: 'play_script_button_preview' },
                    { type: ComponentType.Button, style: ButtonStyle.Danger, label: 'Live', custom_id: 'play_script_button_live' }
                ]
            }
        ]
    });

    let preview: boolean | undefined;

    await prompt_message.awaitMessageComponent({
        filter: collector_filter,
        componentType: ComponentType.Button,
        time: PROMPT_TIMEOUT
    }).then(ia => {
        if (ia.customId == 'play_script_button_preview')
            preview = true;
        else if (ia.customId == 'play_script_button_live')
            preview = false;
    }).catch(async () => {
        await interaction.editReply({
            content: 'This command timed out without your response.',
            components: []
        });
    });

    if (preview === undefined) return;

    let moderated: boolean | undefined;

    if (script.requireModerator) {
        moderated = true;
    }
    else {
        const prompt_message = await interaction.editReply({
            content: 'Are you a player or the moderator?',
            components: [
                {
                    type: 1,
                    components: [
                        { type: ComponentType.Button, style: ButtonStyle.Success, label: 'Player', custom_id: 'play_script_button_player' },
                        { type: ComponentType.Button, style: ButtonStyle.Danger, label: 'Moderator', custom_id: 'play_script_button_moderator' }
                    ]
                }
            ]
        });

        await prompt_message.awaitMessageComponent({
            filter: collector_filter,
            componentType: ComponentType.Button,
            time: PROMPT_TIMEOUT
        }).then(ia => {
            if (ia.customId == 'play_script_button_player')
                moderated = false;
            else if (ia.customId == 'play_script_button_moderator')
                moderated = true;
        }).catch(async () => {
            await interaction.editReply({
                content: 'This command timed out without your response.',
                components: []
            });
        });
    }

    if (moderated === undefined) return;

    await interaction.editReply({
        content: 'Please wait, playing your script...',
        components: []
    });

    const you = interaction.member as GuildMember,
        bot = interaction.guild?.members.resolve(interaction.client?.user?.id) as GuildMember;

    const members = shuffleInPlace([
        ...interaction.channel.members
            .filter(them => !them.user.bot)
            .filter(them => !moderated || them != you)
            .filter(them => them.roles.highest.name == '@everyone' || them.roles.highest.position > bot.roles.highest.position)
            .values()
    ]);

    if (members.length < 1)
        throw `Everyone in ${channelMention(interaction.channel.id)} includes no qualifying members for a script.`;

    if (script.minMembers && members.length < script.minMembers)
        throw `Too few members for script (minimum of ${script.minMembers}, actually ${members.length}).`;

    if (script.maxMembers && members.length > script.maxMembers)
        throw `Too many members for script (maximum of ${script.maxMembers}, actually ${members.length}).`;

    if (script.setup.members === undefined)
        script.setup.members = members.length;

    if (script.rules?.length < 1)
        throw 'Script requires at least 1 rule.';

    const channel_embeds: Embed[] = [],
        direct_embeds = new Map<GuildMember, Embed[]>();

    const cumulative_deal = new Map<GuildMember, string[]>(),
        cumulative_used: string[] = [];

    let recent_deal = new Map<GuildMember, string[]>(),
        recent_used: string[] = [];

    for (const rule of script.rules) {
        const which_used = optionOf(rule.cumulative, script.setup)
            ? cumulative_used
            : recent_used;

        if (!conditionOf(rule, which_used, script.setup))
            continue;

        if ('deal' in rule) {
            const pile: string[] = shuffleInPlace(deckOf(rule.deal, script.setup));

            let cycles = Math.ceil(pile.length / members.length);
            if (rule.limit !== undefined) {
                const limit = valueOf(rule.limit, script.setup);
                if (limit < 1)
                    throw 'Deal limit must be at least 1, if any.';

                cycles = Math.min(limit, cycles);
            }

            recent_deal = new Map();
            recent_used = [];

            dealing:
            for (let c = 1; c <= cycles; c++)
                for (const them of members) {
                    if (pile.length == 0)
                        break dealing;

                    const it = pile.shift() as string;

                    if (recent_deal.has(them))
                        recent_deal.get(them)?.push(it);
                    else
                        recent_deal.set(them, [it]);

                    if (cumulative_deal.has(them))
                        cumulative_deal.get(them)?.push(it);
                    else
                        cumulative_deal.set(them, [it]);

                    if (!recent_used.includes(it))
                        recent_used.push(it);

                    if (!cumulative_used.includes(it))
                        cumulative_used.push(it);
                }

            const sizes: Record<number, GuildMember[]> = {};
            for (const [ them, theirs ] of recent_deal) {
                const size = theirs.length ?? 0;
                if (sizes[size])
                    sizes[size].push(them);
                else
                    sizes[size] = [them];
            }
            for (const size in sizes)
                shuffleInPlace(sizes[size]);

            channel_embeds.push(({
                title: rule.for
                    ? `Dealt for ${rule.for}...`
                    : 'Dealt...',
                fields: [
                    ...Object.keys(sizes).map(Number).sort().reverse().map(size => ({
                        name: `${size > 0 ? `${size} each` : 'None'} to...`,
                        value: trunc(names(sizes[size]), MAX_FIELD_VALUE),
                        inline: true
                    })),
                    ...(pile.length > 0 ? [{
                        name: `${pile.length} leftover for...`,
                        value: trunc(moderated ? moderated.toString() : 'nobody', MAX_FIELD_VALUE),
                        inline: true
                    }] : [])
                ]
            } as Embed));

            const moderator_fields = [];

            for (const [ member, these ] of recent_deal) {
                if (!direct_embeds.has(member))
                    direct_embeds.set(member, []);

                direct_embeds.get(member)?.push(({
                    title: rule.for
                        ? `You were dealt for ${rule.for}...`
                        : 'You were dealt...',
                    description: trunc(commas(these.map(it => `**${it}**`)), MAX_EMBED_DESCRIPTION)
                } as Embed));

                if (moderated)
                    moderator_fields.push({
                        name: trunc(`${commas(these)} to...`, MAX_FIELD_NAME),
                        value: trunc(member.toString(), MAX_FIELD_VALUE),
                        inline: true
                    });
            }

            if (moderated) {
                if (pile.length > 0)
                    moderator_fields.push({
                        name: `${pile.length} leftover for you...`,
                        value: trunc(commas(pile.map(it => `**${it}**`)), MAX_FIELD_VALUE),
                        inline: true
                    });

                if (moderator_fields.length > 0) {
                    if (!direct_embeds.has(you))
                        direct_embeds.set(you, []);

                    direct_embeds.get(you)?.push(({
                        title: 'Dealt...',
                        fields: moderator_fields
                    } as Embed));
                }
            }
        }
        else {
            const which_deal = optionOf(rule.cumulative, script.setup)
                ? cumulative_deal
                : recent_deal;

            if ('show' in rule) {
                for (const [ member, these ] of which_deal) {
                    const member_fields: EmbedField[] = [];

                    these.filter(it => matchOf(it, rule.to, script.setup)).forEach(yours => {
                        for (const show of listOf(rule.show)) {
                            const these_fields: EmbedField[] = [];

                            const limit = valueOf(rule.limit, script.setup);

                            for (const [ them, those ] of which_deal) {
                                if (them != member)
                                    those.filter(it => matchOf(it, show, script.setup) && (!optionOf(rule.hideSame, script.setup) || it != yours)).forEach(theirs => {
                                        const name = trunc(`Via ${yours}...`, MAX_FIELD_NAME),
                                            value = trunc(`${them.toString()} was dealt **${rule.as ?? theirs}**`, MAX_FIELD_VALUE);
                                        if (![ ...member_fields, ...these_fields ].some(it => it.name == name && it.value == value))
                                            these_fields.push({
                                                name,
                                                value,
                                                inline: true
                                            });
                                    });
                            }

                            if (limit)
                                member_fields.push(...choose(these_fields, limit, true));
                            else
                                member_fields.push(...these_fields);
                        }
                    });

                    if (member_fields.length > 0) {
                        shuffleInPlace(member_fields);

                        if (!direct_embeds.has(member))
                            direct_embeds.set(member, []);

                        direct_embeds.get(member)?.push(({
                            title: 'You were shown...',
                            fields: truncFields(member_fields, 'show rules')
                        } as Embed));
                    }
                }
            }
            else if ('announce' in rule) {
                const channel_fields: EmbedField[] = [];

                for (const announce of listOf(rule.announce)) {
                    const these_fields: EmbedField[] = [];

                    const limit = valueOf(rule.limit, script.setup);

                    for (const [ them, those ] of which_deal) {
                        those.filter(it => matchOf(it, announce, script.setup)).forEach(theirs => {
                            const name = trunc(rule.as ?? theirs, MAX_FIELD_NAME),
                                value = trunc(them.toString(), MAX_FIELD_VALUE);
                            if (![ ...channel_fields, ...these_fields ].some(it => it.name == name && it.value == value))
                                these_fields.push({
                                    name,
                                    value,
                                    inline: true
                                });
                        });
                    }

                    if (limit)
                        channel_fields.push(...choose(these_fields, limit, true));
                    else
                        channel_fields.push(...these_fields);
                }

                if (channel_fields.length > 0) {
                    shuffleInPlace(channel_fields);

                    channel_embeds.push(({
                        title: 'Announced...',
                        fields: truncFields(channel_fields, 'announce rules')
                    } as Embed));
                }
            }
            else if ('explain' in rule) {
                const channel_fields: EmbedField[] = [];

                channel_fields.push({
                    name: trunc(rule.explain, MAX_FIELD_NAME),
                    value: trunc(rule.as, MAX_FIELD_VALUE),
                    inline: true
                });

                if (channel_fields.length > 0)
                    channel_embeds.push(({
                        title: 'Explained...',
                        fields: truncFields(channel_fields, 'explain rules')
                    } as Embed));
            }
        }
    }

    if (channel_embeds.length == 0 && direct_embeds.size == 0)
        throw 'The script did not send any channel or direct messages.';

    let channel_content = `${interaction.user.toString()}`;
    if (moderated)
        channel_content = `${channel_content} as **moderator**`;
    channel_content = `${channel_content} played a script`;
    if (script.event)
        channel_content = `${channel_content} for the **${script.event}** event`;

    const embeds_color = !preview ? Colors.Blurple : Colors.Yellow;

    if (!preview) {
        await interaction.editReply({
            content: 'Finished playing your script.'
        });
        await interaction.channel.send({
            content: channel_content,
            embeds: truncEmbeds(channel_embeds, 'rules').map(it => ({ ...it, color: embeds_color }))
        });
    }
    else {
        await interaction.editReply({
            content: `Finished playing your script.\n\n:construction: **Preview for ${channelMention(interaction.channel.id)}** :construction:\n${channel_content}`,
            embeds: truncEmbeds(channel_embeds, 'rules').map(it => ({ ...it, color: embeds_color }))
        });
    }

    for (const [ member, embeds ] of direct_embeds) {
        if (embeds.length > 0) {
            let member_content = member != you ? interaction.user.toString() : 'You';
            if (moderated)
                member_content = `${member_content} as **moderator**`;
            member_content = `${member_content} played a script in ${channelMention(interaction.channel.id)}`;
            if (script.event)
                member_content = `${member_content} for the **${script.event}** event`;

            if (!preview) {
                member.send({
                    content: member_content,
                    embeds: truncEmbeds(embeds, 'rules').map(it => ({ ...it, color: embeds_color }))
                });
            }
            else {
                you.send({
                    content: `:construction: **Preview for ${member != you ? member.toString() : 'You'}** :construction:\n${member_content}`,
                    embeds: truncEmbeds(embeds, 'rules').map(it => ({ ...it, color: embeds_color }))
                });
            }
        }
    }
}
