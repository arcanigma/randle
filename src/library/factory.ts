import { GuildMember, Interaction, TextChannel } from 'discord.js';

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

export function names (members: GuildMember[], separator?: string, conjunction?: string): string {
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

// TODO support @everyone etc within a larger list
// TODO filter duplicates
const re_role = /^<@&(\d+)>$/;
export async function itemize (text: string, interaction: Interaction): Promise<string[]> {
    let items = text.split(',').map(it => it.trim()).filter(Boolean),
        match;
    if (items.length == 1) {
        if (Number(items[0]) >= 1 && Number(items[0]) % 1 == 0) {
            items = (<number[]> Array(Number(items[0])).fill(1)).map((v, i) => String(v + i));
        }
        else if (items[0] == '@everyone' || items[0] == '@here') {
            if (!(interaction.channel instanceof TextChannel))
                throw `Unsupported channel <${interaction.channel?.toString() ?? 'undefined'}>.`;

            items = interaction.channel.members
                .filter(them => !them.user.bot)
                .filter(them => items[0] != '@here' || them.presence?.status == 'online')
                .map(them => them.toString());
        }
        else if ((match = re_role.exec(items[0]))) {
            // TODO get from cache?
            const role = await interaction.guild?.roles.fetch(match[1]);
            if (!role)
                throw `Unsupported role <${match[1]}>.`;

            items = role.members
                .filter(them => !them.user.bot)
                .map(them => them.toString());
        }
        // TODO support macros
    }
    else if (items.length < 1) {
        throw 'Number of items must be at least 1.';
    }
    return items;
}
