import { randomInt } from 'crypto';
import { Client, MessageEmbed } from 'discord.js';
import ordinal from 'ordinal';
import { MAX_EMBED_FIELDS, MAX_EMBED_TITLE, MAX_FIELD_NAME, MAX_FIELD_VALUE, MAX_MESSAGE_EMBEDS } from '../constants';
import { registerSlashCommand } from '../library/backend';
import { trunc, wss } from '../library/factory';
import { blame } from '../library/message';
import { ApplicationCommandData } from '../shims';

export const register = ({ client }: { client: Client }): void => {

    client.on('ready', async () => {
        const slash: ApplicationCommandData = {
            name: 'roll',
            description: 'Roll dice',
            options: [
                {
                    name: 'text',
                    type: 'STRING',
                    description: 'Text including dice codes',
                    required: true
                },
            ]
        };

        await registerSlashCommand(slash, client);
    });

    // TODO refactor into parser
    // TODO support macros

    const re_segments = /\s*;\s*/;
    client.on('interaction', async interaction => {
        if (!interaction.isCommand() || interaction.commandName !== 'roll') return;

        try {
            const text = interaction.options.get('text')?.value as string;

            const clauses = text.trim().split(re_segments),
                segments = clauses.length;

            for (let i = 0; i < segments; i++)
                clauses.push(...expandRepeats(clauses.shift() as string));

            const embeds = rollDice(clauses);

            if (embeds.length > 0)
                await interaction.reply({
                    content: `${interaction.user.toString()} rolled dice`,
                    embeds
                });
            else
                await interaction.reply({
                    embeds: [{
                        title: '⚠️ Warning',
                        description: 'There were no dice to roll.'
                    }],
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

};

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
                clones.push(`${text} on the ${ordinal(i)} roll`);
        else
            for (const label of list)
                clones.push(`${text} for ${label}`);
        return clones;
    }
    else {
        return [clause];
    }
}

function rollDice (clauses: string[]): MessageEmbed[] {
    const embeds = [];

    for (let i = 0; i < clauses.length; i++) {
        clauses[i] = evaluateArithmetic(clauses[i]);

        const fields = [];

        const re_dice_code = /\b([1-9][0-9]*)?d([1-9][0-9]*|%)(?:([HL])([1-9][0-9]*)?)?([+-][0-9]+(?:\.[0-9]+)?)?\b/ig;
        const outcome = clauses[i].replace(re_dice_code, (code, count, size, hilo, keep, modifier) => {
            count = parseInt(count) || 1;
            size = (size != '%' ? parseInt(size) || 1 : 100);

            const rolls: number[] = [];
            for (let i = 1; i <= count; i++)
                rolls.push(randomInt(size) + 1);

            keep = Math.min(parseInt(keep) || 1, count);

            const strikes: {
                [key: number]: number;
            } = {};
            if (hilo) {
                const sorted = rolls.slice();
                if ((hilo as string).toUpperCase() == 'L')
                    sorted.sort((x,y) => x-y);
                else
                    sorted.sort((x,y) => y-x);
                for (let i = keep as number; i < sorted.length; i++) {
                    const key = sorted[i];
                    strikes[key] = (strikes[key] ?? 0) + 1;
                }
            }

            modifier = parseInt(modifier) || 0;
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

            let emoji;
            if (total == 1 * (!hilo ? count : keep) + parseInt(modifier))
                emoji = '🔻';
            else if (total == size * (!hilo ? count : keep) + parseInt(modifier))
                emoji = '🔺';

            if (fields.length < MAX_EMBED_FIELDS)
                fields.push({
                    name: trunc(`${code} ${emoji ?? ''}`, MAX_FIELD_NAME),
                    value: trunc(`${atoms.join(' ')}`, MAX_FIELD_VALUE),
                    inline: true
                });

            return `${total}`;
        });

        if (fields.length == MAX_EMBED_FIELDS)
            fields[MAX_EMBED_FIELDS - 1] = {
                name: '⚠️ Warning',
                value: `Too many rolls to show (limit of ${MAX_EMBED_FIELDS}).`,
                inline: false
            };

        if (outcome != clauses[i]) {
            clauses[i] = outcome;
            clauses[i] = evaluateArithmetic(clauses[i]);
            clauses[i] = prettifyMarkdown(clauses[i]);

            if (embeds.length < MAX_MESSAGE_EMBEDS)
                embeds.push(<MessageEmbed>{
                    title: trunc(`${embeds.length == 0 ? 'Rolled' : 'Then rolled' } ${clauses[i]}.`, MAX_EMBED_TITLE),
                    fields
                });
        }
    }

    // TODO use truncation of embeds and fields
    if (embeds.length == MAX_MESSAGE_EMBEDS)
        embeds[MAX_MESSAGE_EMBEDS - 1] = <MessageEmbed>{
            title: '⚠️ Warning',
            description: `Too many groups to show (limit of ${MAX_MESSAGE_EMBEDS}).`
        };

    return embeds;
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
