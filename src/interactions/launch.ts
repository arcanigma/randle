import { ApplicationCommandType, CacheType, Client, Embed, EmbedField, GuildMember, Interaction, TextChannel, VoiceChannel } from 'discord.js';
import got from 'got';
import JSON5 from 'json5';
import { MAX_EMBED_DESCRIPTION, MAX_FIELD_NAME, MAX_FIELD_VALUE } from '../constants.js';
import { createMenuCommand } from '../library/backend.js';
import { commas, names, trunc } from '../library/factory.js';
import { blame, truncEmbeds, truncFields } from '../library/message.js';
import { Script } from '../library/script.js';
import { choose, conditionOf, deckOf, listOf, matchOf, optionOf, shuffleInPlace, valueOf } from '../library/solve.js';

export const MAX_IMPORTS = 5;

export async function register ({ client }: { client: Client }): Promise<void> {
    await createMenuCommand(client, {
        type: ApplicationCommandType.Message,
        name: 'Launch Script',
    });

    await createMenuCommand(client, {
        type: ApplicationCommandType.Message,
        name: 'Launch Script as Moderator',
    });

    await createMenuCommand(client, {
        type: ApplicationCommandType.Message,
        name: 'Preview Script',
    });

    await createMenuCommand(client, {
        type: ApplicationCommandType.Message,
        name: 'Preview Script as Moderator',
    });
}

const re_highlight = /^```(json\b)?|```$/g;
export async function execute ({ interaction }: { interaction: Interaction<CacheType>}): Promise<boolean> {
    if (!(
        interaction.isMessageContextMenuCommand() &&
        (
            interaction.commandName == 'Launch Script' ||
            interaction.commandName == 'Launch Script as Moderator' ||
            interaction.commandName == 'Preview Script' ||
            interaction.commandName == 'Preview Script as Moderator'
        )
    )) return false;

    try {
        if (!(
            interaction.channel instanceof TextChannel ||
            interaction.channel instanceof VoiceChannel
        )) throw 'This command can only be used in text channels and text chats in voice channels.';

        const you = interaction.member as GuildMember,
            bot = interaction.guild?.members.resolve(interaction.client?.user?.id as string) as GuildMember,
            moderator = interaction.commandName.includes('Moderator'),
            preview = interaction.commandName.includes('Preview');

        const members = shuffleInPlace([
            ...interaction.channel.members
                .filter(them => !them.user.bot)
                .filter(them => !moderator || them != you)
                .filter(them => them.roles.highest.name == '@everyone' || them.roles.highest.position > bot.roles.highest.position)
                .values()
        ]);

        if (members.length < 1)
            throw `Everyone in ${interaction.channel.toString()} includes no qualifying members for a script.`;

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

        if (script.requireModerator && !moderator)
            throw 'Script requires a moderator.';

        if (script.minMembers && members.length < script.minMembers)
            throw `Too few members for script (minimum of ${script.minMembers}, actually ${members.length}).`;

        if (script.maxMembers && members.length > script.maxMembers)
            throw `Too many members for script (maximum of ${script.maxMembers}, actually ${members.length}).`;

        if (script.setup.members === undefined)
            script.setup.members = members.length;

        if (script.rules?.length < 1)
            throw 'Script requires at least 1 rule.';

        const channel_embeds: Embed[] = [],
            direct_embeds: Map<GuildMember, Embed[]> = new Map();

        const cumulative_deal: Map<GuildMember, string[]> = new Map(),
            cumulative_used: string[] = [];

        let recent_deal: Map<GuildMember, string[]> = new Map();
        const recent_used: string[] = [];

        for (const rule of script.rules) {
            if ('deal' in rule) {
                const pile: string[] = shuffleInPlace(deckOf(rule.deal, script.setup));

                let cycles = Math.ceil(pile.length / members.length);
                if (rule.limit !== undefined) {
                    if (rule.limit < 0)
                        throw 'Deal limit must be at least 1, if any.';

                    cycles = Math.min(valueOf(rule.limit, script.setup), cycles);
                }

                recent_deal = new Map();

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

                const sizes: { [size: number]: GuildMember[] } = {};
                for (const [ them, theirs ] of recent_deal) {
                    const size = theirs.length ?? 0;
                    if (sizes[size])
                        sizes[size].push(them);
                    else
                        sizes[size] = [them];
                }
                for (const size in sizes)
                    shuffleInPlace(sizes[size]);

                channel_embeds.push(<Embed> {
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
                            value: trunc(moderator ? moderator.toString() : 'nobody', MAX_FIELD_VALUE),
                            inline: true
                        }] : [])
                    ]
                });

                const moderator_fields = [];

                for (const [ member, these ] of recent_deal) {
                    if (!direct_embeds.has(member))
                        direct_embeds.set(member, []);

                    direct_embeds.get(member)?.push(<Embed> {
                        title: rule.for
                            ? `You were dealt for ${rule.for}...`
                            : 'You were dealt...',
                        description: trunc(commas(these.map(it => `**${it}**`)), MAX_EMBED_DESCRIPTION)
                    });

                    if (moderator)
                        moderator_fields.push({
                            name: trunc(`${commas(these)} to...`, MAX_FIELD_NAME),
                            value: trunc(member.toString(), MAX_FIELD_VALUE),
                            inline: true
                        });
                }

                if (moderator) {
                    if (pile.length > 0)
                        moderator_fields.push({
                            name: `${pile.length} leftover for you...`,
                            value: trunc(commas(pile.map(it => `**${it}**`)), MAX_FIELD_VALUE),
                            inline: true
                        });

                    if (moderator_fields.length > 0) {
                        if (!direct_embeds.has(you))
                            direct_embeds.set(you, []);

                        direct_embeds.get(you)?.push(<Embed> {
                            title: 'Dealt...',
                            fields: moderator_fields
                        });
                    }
                }
            }
            else {
                let timely_deal: Map<GuildMember, string[]>,
                    timely_used: string[];

                if (optionOf(rule.cumulative, script.setup)) {
                    timely_deal = cumulative_deal;
                    timely_used = cumulative_used;
                }
                else {
                    timely_deal = recent_deal;
                    timely_used = recent_used;
                }

                const enabled = conditionOf(rule, timely_used, script.setup);

                if (enabled)
                    if ('show' in rule) {
                        for (const [ member, these ] of timely_deal) {
                            const member_fields: EmbedField[] = [];

                            these.filter(it => matchOf(it, rule.to, script.setup)).forEach(yours => {
                                for (const show of listOf(rule.show)) {
                                    const these_fields: EmbedField[] = [];

                                    const limit = valueOf(rule.limit, script.setup);

                                    for (const [ them, those ] of timely_deal) {
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

                                direct_embeds.get(member)?.push(<Embed> {
                                    title: 'You were shown...',
                                    fields: truncFields(member_fields, 'show rules')
                                });
                            }
                        }
                    }
                    else if ('announce' in rule) {
                        const channel_fields: EmbedField[] = [];

                        for (const announce of listOf(rule.announce)) {
                            const these_fields: EmbedField[] = [];

                            const limit = valueOf(rule.limit, script.setup);

                            for (const [ them, those ] of timely_deal) {
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

                            channel_embeds.push(<Embed> {
                                title: 'Announced...',
                                fields: truncFields(channel_fields, 'announce rules')
                            });
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
                            channel_embeds.push(<Embed> {
                                title: 'Explained...',
                                fields: truncFields(channel_fields, 'explain rules')
                            });
                    }
            }
        }

        if (channel_embeds.length == 0 && direct_embeds.size == 0)
            throw 'The script did not send any channel or direct messages.';

        let channel_content = `${interaction.user.toString()}`;
        if (moderator)
            channel_content = `${channel_content} as **moderator**`;
        channel_content = `${channel_content} ran a script`;
        if (script.event)
            channel_content = `${channel_content} for the **${script.event}** event`;

        if (!preview)
            await interaction.reply({
                content: channel_content,
                embeds: truncEmbeds(channel_embeds, 'rules')
            });
        else {
            await interaction.reply({
                content: `:construction: **Preview for Channel** \u2022 ${channel_content}`,
                embeds: truncEmbeds(channel_embeds, 'rules'),
                ephemeral: true
            });
        }

        for (const [ member, embeds ] of direct_embeds) {
            if (embeds.length > 0) {
                let content = member != you ? interaction.user.toString() : 'You';
                if (moderator)
                    content = `${content} as **moderator**`;
                content = `${content} ran a script in ${interaction.channel.toString()}`;
                if (script.event)
                    content = `${content} for the **${script.event}** event`;

                if (!preview)
                    await member.send({
                        content,
                        embeds: truncEmbeds(embeds, 'rules')
                    });
                else
                    await you.send({
                        content: `:construction: **Preview for ${member != you ? member.toString() : 'You'}** \u2022 ${content}`,
                        embeds: truncEmbeds(embeds, 'rules')
                    });
            }
        }
    }
    catch (error: unknown) {
        await interaction.reply({
            embeds: blame({ error, interaction }),
            ephemeral: true
        });
    }

    return true;
}
