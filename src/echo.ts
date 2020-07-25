import { App } from '@slack/bolt';
import { blame } from './library/factory';
import { debug, direct, nonthread } from './library/listeners';

export const events = (app: App): void => {
    const re_echo = /^!?echo\s+(.*)/i;
    app.message(re_echo, nonthread, direct, debug, async ({ message, context, say }) => {
        try {
            await say(context.matches[1].trim());
        }
        catch (err) {
            await say(blame(err, message));
        }
    });

    const re_throw = /^!?throw\s+(system|user)\s+error\s+(.*)/i;
    app.message(re_throw, nonthread, direct, debug, async ({ message, context, say }) => {
        try {
            if (context.matches[1] == 'system')
                throw new Error(context.matches[2] ?? 'undefined');
            else if (context.matches[1] == 'user')
                throw context.matches[2] ?? 'undefined';
        }
        catch (err) {
            await say(blame(err, message));
        }
    });
};
