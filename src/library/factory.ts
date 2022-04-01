import { GuildMember, Interaction, TextChannel, VoiceChannel } from 'discord.js';

export function commas (list: (string | undefined)[], separator=', ', conjunction='and'): string {
    const flist = <string[]>list.filter(it => it !== undefined);
    if (flist.length == 1)
        return flist[0];
    else if (flist.length == 2)
        return `${flist[0]} ${conjunction} ${flist[1]}`;
    else if (flist.length >= 3)
        return `${flist.slice(0, -1).join(separator)}, ${conjunction} ${flist.slice(-1)[0]}`;
    else
        return '';
}

export function names (members: (GuildMember | string)[], separator?: string, conjunction?: string): string {
    return commas(members.map(them => `${them.toString()}`), separator, conjunction) || 'nobody';
}

export function size (object: {[key: string]: unknown}): number {
    return Object.keys(object).length;
}

export function trunc (text: string, limit: number): string {
    if (text === undefined)
        return 'undefined';
    else if (text.length <= limit)
        return text;
    else
        return text.substring(0, limit-3) + '...';
}

const re_wss = /\s+/g;
export function wss (text: string): string {
    return text.trim().replace(re_wss, ' ');
}

export function itemize (text: string, interaction: Interaction): string[] {
    const elements = text.split(',').map(it => it.trim()).filter(Boolean);

    if (elements.length == 1) {
        const num = Number(elements[0]);
        if (num >= 1 && num % 1 == 0)
            return (<number[]> Array(num).fill(1)).map((v, i) => String(v + i));
    }

    const items: string[] = [];
    for (const it of elements) {
        const them = membersOf(it, interaction);

        if (them.members.length > 0)
            items.push(...them.members);
        else
            items.push(it);
    }

    if (items.length < 1)
        throw 'Number of items must be at least 1.';

    return items;
}

const re_role = /^<@&(\d+)>$|^(\d+)$/;
export function membersOf (mention: string, interaction: Interaction): { name: string; members: string[] } {
    if (
        (mention == '@everyone' || mention == '@here') &&
        (interaction.channel instanceof TextChannel || interaction.channel instanceof VoiceChannel)
    ) {
        return {
            name: mention,
            members: interaction.channel.members
                .filter(them => !them.user.bot)
                .filter(them => mention != '@here' || them.presence?.status == 'online')
                .map(them => them.toString())
        };
    }

    const match = re_role.exec(mention),
        role_id = match?.[1] ?? match?.[2];

    if (role_id) {
        const role = interaction.guild?.roles.cache.get(role_id);
        if (role)
            return {
                name: role.toString(),
                members: role?.members
                    .map(them => them.toString())
            };
    }

    return {
        name: 'undefined',
        members: []
    };
}
