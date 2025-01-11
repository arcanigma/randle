import { randomInt } from 'crypto';
import { color, RGBColor } from 'd3-color';
import { interpolateRgb, piecewise } from 'd3-interpolate';
import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputApplicationCommandData, Collection, Colors, CommandInteraction, Embed, EmbedField, Emoji, MessageFlags } from 'discord.js';
import * as inflection from 'inflection';
import { MAX_EMBED_TITLE, MAX_FIELD_NAME, MAX_FIELD_VALUE } from '../library/constants.js';
import { repeat } from '../library/lists.js';
import { truncEmbeds, truncFields } from '../library/messages.js';
import { trunc, wss } from '../library/texts.js';

export const data: ChatInputApplicationCommandData = {
    type: ApplicationCommandType.ChatInput,
    name: 'roll',
    description: 'Roll dice',
    options: [
        {
            name: 'text',
            type: ApplicationCommandOptionType.String,
            description: 'Text including dice codes',
            required: true
        },
    ]
};

const color_gradient = piecewise(interpolateRgb, [
    '#' + Colors.Red.toString(16),
    '#' + Colors.Yellow.toString(16),
    '#' + Colors.Green.toString(16)
]);

const re_boundary = /\s*;\s*/;
export async function execute (interaction: CommandInteraction): Promise<void> {
    if (!interaction.channel?.isTextBased())
        throw 'This command can only be used in text-based channels.';

    const text = interaction.options.get('text')?.value as string,
        clauses = text.trim().split(re_boundary),
        base_clauses = clauses.length;

    const app_emojis = await interaction.client.application.emojis.fetch(),
        emoji_arrays = findEmojiArrays(text, app_emojis);

    for (let i = 0; i < base_clauses; i++)
        clauses.push(...expandRepeats(clauses.shift() as string));

    const embeds = rollDice(clauses, emoji_arrays);

    if (embeds.length > 0) {
        await interaction.reply({
            content: `${interaction.user.toString()} rolled dice`,
            embeds
        });
    }
    else {
        await interaction.reply({
            embeds: [{
                title: '⚠️ Warning',
                description: 'There were no dice to roll.'
            }],
            flags: MessageFlags.Ephemeral
        });
    }
}

const re_ellipsis = /\.\.\./,
    re_commas = /\s*,\s*/;
function expandRepeats (clause: string) {
    const parts = clause.split(re_ellipsis).map(it => it.trim());
    if (parts.length == 2 && parts[0] && parts[1]) {
        const text = parts[0].replace(re_trail, ''),
            list = parts[1].split(re_commas),
            reps = parseInt(list[0]);
        const clones = [];
        if (list.length == 1 && reps >= 1)
            for (let i = 1; i <= reps; i++)
                clones.push(`${text} on the ${inflection.ordinalize(String(i))} roll`);
        else
            for (const label of list)
                clones.push(`${text} for ${label}`);
        return clones;
    }
    else {
        return [clause];
    }
}

const re_dice_code = /\b([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?\b/ig,
    re_array_code = /(?:\b([1-9][0-9]*)?[dx]?)?\{(\w+?)\}/ig;
function rollDice (clauses: string[], arrays: Record<string, string[]>): Embed[] {
    const embeds: Embed[] = [];

    for (let i = 0; i < clauses.length; i++) {
        clauses[i] = evaluateArithmetic(clauses[i]);

        const fields: EmbedField[] = [],
            percentages: number[] = [];

        const outcome = clauses[i].replace(re_dice_code, (code: string, count: string | number, size: string | number, hilo: string | number, keep: string | number, modifier: string | number) => {
            count = parseInt(count as string) || 1;
            size = (size != '%' ? parseInt(size as string) || 1 : 100);

            const rolls: number[] = [];
            for (let i = 1; i <= count; i++)
                rolls.push(randomInt(size) + 1);

            keep = Math.min(parseInt(keep as string) || 1, count);

            const strikes: Record<number, number> = {};
            if (hilo) {
                const sorted = rolls.slice();
                if ((hilo as string).toUpperCase() == 'L')
                    sorted.sort((x,y) => x-y);
                else
                    sorted.sort((x,y) => y-x);
                for (let i = keep ; i < sorted.length; i++) {
                    const key = sorted[i];
                    strikes[key] = (strikes[key] ?? 0) + 1;
                }
            }

            modifier = parseInt(modifier as string) || 0;
            if (modifier)
                rolls.push(modifier);

            let total = 0;
            const atoms = [];
            for (const roll of rolls) {
                const sign = roll >= 0 ? '+' : '-',
                    face = Math.abs(roll);

                if (atoms.length > 0 || sign == '-')
                    atoms.push(sign);

                if (!strikes[roll]) {
                    total += roll;
                    atoms.push(face);
                }
                else {
                    strikes[roll]--;
                    atoms.push(`~~${face}~~`);
                }
            }

            if (atoms.length == 1)
                atoms[0] = `**${atoms[0]}**`;
            else
                atoms.unshift(`**${total}**`, '=');

            fields.push({
                name: trunc(code, MAX_FIELD_NAME),
                value: trunc(`${atoms.join(' ')}`, MAX_FIELD_VALUE),
                inline: true
            });

            const min = 1 * (!hilo ? count : keep) + modifier,
                max = size * (!hilo ? count : keep) + modifier;

            if (min < max)
                percentages.push((total - min) / (max - min));

            return `${total}`;
        }).replace(re_array_code, (code: string, count: string | number, slug: string) => {
            slug = slug.toLowerCase();

            if (!arrays[slug])
                return code;

            count = parseInt(count as string) || 1;

            const rolls = repeat(arrays[slug], count),
                title = slug[0].toUpperCase() + slug.slice(1);

            fields.push({
                name: trunc(`${title}`, MAX_FIELD_NAME),
                value: trunc(`${rolls.join(' ')}`, MAX_FIELD_VALUE),
                inline: true
            });

            return `${count} of ${title}`;
        });

        if (outcome != clauses[i]) {
            clauses[i] = outcome;
            clauses[i] = evaluateArithmetic(clauses[i]);
            clauses[i] = prettifyMarkdown(clauses[i]);

            let embed_color: number | undefined;
            if (percentages.length > 0) {
                const avg_percentage = percentages.reduce((a, b) => a + b) / percentages.length;
                embed_color = parseInt((color(color_gradient(avg_percentage)) as RGBColor).formatHex().substring(1), 16);
            }
            else {
                embed_color = undefined;
            }

            embeds.push(({
                title: trunc(`${embeds.length == 0 ? 'Rolled' : 'Then rolled' } ${clauses[i]}.`, MAX_EMBED_TITLE),
                fields: truncFields(fields, 'rolls'),
                color: embed_color
            } as Embed));
        }
    }

    return truncEmbeds(embeds, 'groups');
}

const re_number = /\b(?<![:_~*])[1-9][0-9]*(?![:_~*])\b/g,
    re_tag = /<([^>]+)>/g,
    re_trail = /^[\s.;,]+|[\s.;,]+$/g;
function prettifyMarkdown (clause: string) {
    clause = wss(clause
        .replace(re_number, '__$&__')
        .replace(re_tag, '')
        .replace(re_trail, '')
    );
    return clause;
}

const re_math = /([+-]|\b)([0-9]+(?:\.[0-9]+)?)\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\b/;
function evaluateArithmetic (clause: string) {
    return regexClosure(clause, re_math, (_, sign, x, op, y) => {
        const ix = parseInt(`${sign}${x}`),
            iy = parseInt(`${op}${y}`),
            sum = ix+iy;
        return sign && sum >= 0
            ? `+${sum}`
            : String(sum);
    });
}

function regexClosure (clause: string, re: RegExp, fun: (substring: string, ...args: (string | number)[]) => string) {
    let old;
    do {
        old = clause;
        clause = clause.replace(re, fun);
    } while (clause != old);
    return clause;
}

function findEmojiArrays (text: string, emojis: Collection<string, Emoji>): Record<string, string[]> {
    const arrays: Record<string, string[]> = {};
    for (let [ , , slug ] of text.matchAll(re_array_code)) {
        slug = slug.toLowerCase();

        if (arrays[slug])
            continue;

        const matches = emojis
            .filter(e => e.name?.toLowerCase().startsWith(`${slug}_`) ?? false)
            .map(e => e.toString());

        if (matches.length > 0)
            arrays[slug] = matches;
    }
    return arrays;
}
