import { ApplicationCommandData, Client, CommandInteraction, EmbedField, GuildMember, MessageEmbed, Snowflake, TextChannel } from 'discord.js';
import got from 'got';
import JSON5 from 'json5';
import { MAX_EMBED_DESCRIPTION, MAX_FIELD_NAME, MAX_FIELD_VALUE } from '../constants';
import { registerApplicationCommand } from '../library/backend';
import { commas, names, trunc } from '../library/factory';
import { blame, truncEmbeds, truncFields } from '../library/message';
import { AnnounceRule, ExplainRule, Items, Rules, Script, ShowRule } from '../library/script';
import { build, enable, listify, matches, shuffleInPlace, validate } from '../library/solve';

export const MAX_IMPORTS = 5;

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            type: 'CHAT_INPUT',
            name: 'run',
            description: 'Run a script',
            options: [
                {
                    name: 'url',
                    type: 'STRING',
                    description: 'A URL to a message, attachment, or external file containing a JSON script',
                    required: true
                },
                {
                    name: 'moderator',
                    type: 'USER',
                    description: 'A member who serves as moderator',
                    required: false
                }
            ]
        };

        await registerApplicationCommand(slash, client);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'run') return;

        await interaction.deferReply();

        try {
            if (!(interaction.channel instanceof TextChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            const url = interaction.options.get('url')?.value as string,
                moderator = interaction.channel.members.get(interaction.options.get('moderator')?.value as Snowflake);

            // TODO option to include/exclude, re: admins/owners
            const members = shuffleInPlace([
                ...interaction.channel.members
                    .filter(them => !them.user.bot)
                    .filter(them => !moderator || them != moderator)
                    .values()
            ]);

            const script = await scriptFromURL(url, interaction);

            if (script.values) {
                if (script.values.members === undefined)
                    script.values.members = members.length;
            }
            else {
                script.values = {
                    members: members.length
                };
            }

            if (script.import) {
                const imports = listify(script.import);

                delete script.import;

                if (imports.length > MAX_IMPORTS)
                    throw `Too many imports in script (limit of ${MAX_IMPORTS}).`;

                for (const i_url of imports) {
                    const i_script = await scriptFromURL(i_url, interaction);

                    if ('import' in i_script)
                        throw `Forbidden nested import in \`${i_url}\` import.`;

                    if ('event' in i_script)
                        script.event = script.event !== undefined
                            ? `${script.event} \u2022 ${<string> i_script.event}`
                            : i_script.event;

                    if ('sets' in i_script)
                        script.sets = Object.assign(script.sets ?? {}, i_script.sets);

                    if ('values' in i_script)
                        script.values = Object.assign(script.values ?? {}, i_script.values);

                    if ('options' in i_script)
                        script.options = Object.assign(script.options ?? {}, i_script.options);

                    if ('requireModerator' in i_script)
                        script.requireModerator =
                            (script.requireModerator ?? false)
                            || (i_script.requireModerator ?? false);

                    if ('minMembers' in i_script)
                        script.minMembers = Math.max(
                            script.minMembers ?? Number.MIN_SAFE_INTEGER,
                            i_script.minMembers ?? Number.MIN_SAFE_INTEGER
                        );

                    if ('maxMembers' in i_script)
                        script.maxMembers = Math.min(
                            script.maxMembers ?? Number.MAX_SAFE_INTEGER,
                            i_script.maxMembers ?? Number.MAX_SAFE_INTEGER
                        );

                    if ('limit' in i_script)
                        script.limit = Math.min(
                            script.limit ?? Number.MAX_SAFE_INTEGER,
                            i_script.limit ?? Number.MAX_SAFE_INTEGER
                        );

                    if ('deal' in i_script)
                        script.deal = <Items> listify([ script.deal, i_script.deal ]);

                    if ('rules' in i_script)
                        script.rules = <Rules> listify([ script.rules, i_script.rules ]);
                }
            }

            if (script.requireModerator && !moderator)
                throw 'Script requires a moderator.';

            if (script.minMembers && members.length < script.minMembers)
                throw `Too few members for script (${members.length}, minimum of ${script.minMembers}).`;

            if (script.maxMembers && members.length > script.maxMembers)
                throw `Too many members for script (${members.length}, maximum of ${script.maxMembers}).`;

            if (!script.deal)
                throw 'Script requires a deal.';

            const items = shuffleInPlace(build(script.deal, script));

            if (script.dealFirst)
                items.unshift(...shuffleInPlace(build(script.dealFirst, script)));

            if (script.dealLast)
                items.push(...shuffleInPlace(build(script.dealLast, script)));

            const uniques = items.filter((item, index) => items.indexOf(item) === index);

            const dealt: Map<GuildMember, string[]> = new Map();
            const rounds = !script.limit
                ? Math.ceil(items.length / members.length)
                : Math.min(script.limit, Math.floor(items.length / members.length));
            for (let round = 1; round <= rounds; round++)
                members.forEach(them => {
                    if (items.length > 0) {
                        if (dealt.has(them))
                            dealt.get(them)?.push(<string>items.shift());
                        else
                            dealt.set(them, [<string>items.shift()]);
                    }
                });

            if (dealt.size == 0)
                throw 'You must deal at least 1 item.';

            const counts: {
                [count: number]: GuildMember[];
            } = {};
            members.filter(them => dealt.has(them)).forEach(them => {
                const count = dealt.get(them)?.length ?? 0;
                if (!counts[count])
                    counts[count] = [them];
                else
                    counts[count].push(them);
            });
            for (const count in counts)
                shuffleInPlace(counts[count]);

            let global_content = `${interaction.user.toString()}`;
            if (moderator)
                if (moderator == interaction.member)
                    global_content = `${global_content} (**moderator**)`;
                else
                    global_content = `${global_content} on behalf of ${moderator.toString()} (**moderator**)`;
            global_content = `${global_content} ran a script`;
            if (script.event)
                global_content = `${global_content} for the **${script.event}** event`;

            const global_embeds: MessageEmbed[] = [];

            global_embeds.push(<MessageEmbed> {
                title: 'Dealt...',
                fields: [
                    ...Object.keys(counts).map(Number).sort().reverse().map(count => ({
                        name: `${count > 0 ? `${count} each` : 'None'} to...`,
                        value: trunc(names(counts[count]), MAX_FIELD_VALUE),
                        inline: true
                    })),
                    ...(items.length > 0 ? [{
                        name: `${items.length} leftover for...`,
                        value: trunc(moderator ? moderator.toString() : 'Nobody', MAX_FIELD_VALUE),
                        inline: true
                    }] : [])
                ]
            });

            if (script.rules) {
                const announce_fields: EmbedField[] = [];

                listify(script.rules).filter((rule): rule is AnnounceRule => 'announce' in rule && enable(rule, uniques, script.options)).forEach(rule =>
                    listify(rule.announce).forEach(announce =>
                        dealt.forEach((whose, who) =>
                            whose.filter(it => matches(it, announce, script)).forEach(which => {
                                const name = trunc(rule.as ?? which, MAX_FIELD_NAME),
                                    value = trunc(who.toString(), MAX_FIELD_VALUE);
                                if (!announce_fields.some(it => it.name == name && it.value == value))
                                    announce_fields.push({
                                        name,
                                        value,
                                        inline: true
                                    });
                            })
                        )
                    )
                );

                if (announce_fields.length > 0) {
                    shuffleInPlace(announce_fields);

                    global_embeds.push(<MessageEmbed> {
                        title: 'Announced...',
                        fields: truncFields(announce_fields, 'announce rules')
                    });
                }

                const explain_fields: EmbedField[] = [];

                listify(script.rules).filter((rule): rule is ExplainRule => 'explain' in rule && enable(rule, uniques, script.options)).forEach(rule =>
                    explain_fields.push({
                        name: trunc(rule.explain, MAX_FIELD_NAME),
                        value: trunc(rule.as, MAX_FIELD_VALUE),
                        inline: true
                    })
                );

                if (explain_fields.length > 0)
                    global_embeds.push(<MessageEmbed> {
                        title: 'Explained...',
                        fields: truncFields(explain_fields, 'explain rules')
                    });
            }

            await interaction.editReply({
                content: global_content,
                embeds: truncEmbeds(global_embeds, 'rules')
            });

            const mod_embeds: MessageEmbed[] = [],
                mod_fields: EmbedField[] = [];

            for (const [ member, items ] of dealt) {
                let proxy_content = interaction.member != member ? interaction.user.toString() : 'You';
                if (moderator)
                    if (moderator == interaction.member)
                        proxy_content = `${proxy_content} (**moderator**)`;
                    else
                        proxy_content = `${proxy_content} on behalf of ${moderator != member ? moderator.toString() : 'you'} (**moderator**)`;
                proxy_content = `${proxy_content} ran a script`;
                if (script.event)
                    proxy_content = `${proxy_content} for the **${script.event}** event in ${interaction.channel.toString()}`;

                const per_embeds: MessageEmbed[] = [];

                per_embeds.push(<MessageEmbed> {
                    title: 'You were dealt...',
                    description: trunc(commas(items.map(it => `**${it}**`)), MAX_EMBED_DESCRIPTION)
                    // TODO reveal button
                });

                if (moderator)
                    mod_fields.push({
                        name: trunc(`${commas(items)} to...`, MAX_FIELD_NAME),
                        value: trunc(member.toString(), MAX_FIELD_VALUE),
                        inline: true
                    });

                if (script.rules) {
                    const show_fields: EmbedField[] = [];

                    listify(script.rules).filter((rule): rule is ShowRule => 'show' in rule && enable(rule, uniques, script.options)).forEach(rule =>
                        listify(rule.to).forEach(to =>
                            dealt.get(member)?.filter(it => matches(it, to, script)).forEach(yours =>
                                listify(rule.show).forEach(show =>
                                    dealt.forEach((theirs, them) => {
                                        if (them != member) {
                                            theirs.filter(it => matches(it, show, script) && (!validate(rule.distinctive, script.options) || it != yours)).forEach(their => {
                                                const name = trunc(`Via ${yours}...`, MAX_FIELD_NAME),
                                                    value = trunc(`${them.toString()} was dealt **${rule.as ?? their}**`, MAX_FIELD_VALUE);
                                                if (!show_fields.some(it => it.name == name && it.value == value))
                                                    show_fields.push({
                                                        name,
                                                        value,
                                                        inline: true
                                                    });
                                            });
                                        }
                                    })
                                )
                            )
                        )
                    );

                    if (show_fields.length > 0) {
                        shuffleInPlace(show_fields);

                        per_embeds.push(<MessageEmbed> {
                            title: 'You were shown...',
                            fields: truncFields(show_fields, 'show rules')
                        });
                    }
                }

                if (per_embeds.length > 0)
                    await member.send({
                        content: proxy_content,
                        embeds: truncEmbeds(per_embeds, 'rules')
                    });
            }

            if (moderator) {
                let mod_content = interaction.member != moderator ? interaction.user.toString() : 'You';
                if (moderator)
                    if (moderator == interaction.member)
                        mod_content = `${mod_content} (**moderator**)`;
                    else
                        mod_content = `${mod_content} on behalf of you (**moderator**)`;
                mod_content = `${mod_content} ran a script`;
                if (script.event)
                    mod_content = `${mod_content} for the **${script.event}** event in ${interaction.channel.toString()}`;

                if (items.length > 0)
                    mod_fields.push({
                        name: `${items.length} leftover for you...`,
                        value: trunc(commas(items.map(it => `**${it}**`)), MAX_FIELD_VALUE),
                        inline: true
                    });

                if (mod_fields.length > 0)
                    mod_embeds.push(<MessageEmbed> {
                        title: 'Dealt...',
                        fields: mod_fields
                    });

                if (mod_embeds.length > 0)
                    await moderator.send({
                        content: mod_content,
                        embeds: mod_embeds
                    });
            }
        }
        catch (error: unknown) {
            await interaction.deleteReply();

            await interaction.followUp({
                embeds: blame({ error, interaction }),
                ephemeral: true
            });
        }
    });

};

async function scriptFromURL (url: string, interaction: CommandInteraction): Promise<Script> {
    if (interaction.channel == null)
        throw `Unsupported channel when accessing \`${url}\` script.`;

    const re_message_url = new RegExp(`^https?://(.+)/channels/${interaction.guildId as string}/${interaction.channelId }/(\\d+)/?$`),
        match_message = re_message_url.exec(url);

    let data: string;
    if (match_message) {
        const message = await interaction.channel.messages.fetch(match_message[2] );

        if (message.attachments.size == 0) {
            if (message.content.length > 0)
                data = message.content.replace(/^`+|`+$/g, '');
            else
                throw `No text or attachments in \`${url}\` message.`;
        }
        else if (message.attachments.size == 1) {
            const attachment_url = message.attachments.first()?.attachment as string;

            try {
                data = await got.get(attachment_url).text();
            }
            catch (error) {
                throw `Attachment error ${(error as Error).message} in \`${url}\` message.`;
            }
        }
        else {
            throw `Too many attachments (${message.attachments.size}, limit of 1) in \`${url}\` message.`;
        }
    }
    else {
        try {
            data = await got.get(url).text();
        }
        catch (error) {
            throw `Web error ${(error as Error).message} when accessing \`${url}\` script.`;
        }
    }

    let script: Script;
    try {
        script = JSON5.parse(data);
    }
    catch (error) {
        throw `JSON error \`${JSON.stringify(error)}\` when parsing \`${url}\` script.`;
    }

    return script;
}
