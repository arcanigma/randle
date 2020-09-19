import { App } from '@slack/bolt';
import { names } from './library/factory';
import { debug, direct, nonthread } from './library/listeners';
import { getMembers } from './library/lookup';
import { blame } from './library/messages';


export const events = (app: App): void => {
    const re_echo = /^!?echo\s+(.*)/i;
    app.message(re_echo, nonthread, direct, debug, async ({ message, context, client, say }) => {
        try {
            await say(context.matches[1].trim());
        }
        catch (err) {
            await blame({ error: err, message, context, client });
        }
    });

    const re_throw = /^!?throw\s+(system|user)\s+error(?:\s+(.*))?/i;
    app.message(re_throw, nonthread, direct, debug, async ({ message, context, client }) => {
        try {
            if (context.matches[1] == 'system')
                throw new Error(context.matches[2] ?? 'undefined');
            else if (context.matches[1] == 'user')
                throw context.matches[2] ?? 'undefined';
        }
        catch (err) {
            await blame({ error: err, message, context, client });
        }
    });

    const re_whois = /^!?whois\s+<#(\w+)\|\w+>$/i;
    app.message(re_whois, nonthread, direct, debug, async ({ message, context, client, say }) => {
        try {
            const channel = context.matches[1],
                users = await getMembers(channel, context, client);

            await say(`<#${channel}> is ${names(users)}.`);
        }
        catch (err) {
            await blame({ error: err, message, context, client });
        }
    });
};
