const CHANNEL = 'channel',
      PRIVATE_CHANNEL = 'group',
      DIRECT = 'im',
      MULTI_DIRECT = 'mpim';

module.exports = {

    debug: async ({ message, context, next }) => {
        console.log({
            message: message,
            context: context
        });
        await next();
    },

    nonthread: async ({ message, next }) => {
        if (!message.thread_ts)
            await next();
    },

    direct: async ({ message, next }) => {
        if ([DIRECT].includes(message.channel_type))
            await next();
    },

    community: async ({ message, next }) => {
        if ([CHANNEL, PRIVATE_CHANNEL, MULTI_DIRECT].includes(message.channel_type))
            await next();
    },

    anywhere: async ({ message, next }) => {
        if ([CHANNEL, PRIVATE_CHANNEL, MULTI_DIRECT, DIRECT].includes(message.channel_type))
            await next();
    }
}
