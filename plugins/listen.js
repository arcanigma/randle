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

    limit: async ({ message, context, next }) => {
        if (!context.limited) {
            context.limited = true;
            await next();
        }
    },

    no_thread: async ({ message, next }) => {
        if (!message.thread_ts)
            await next();
    },

    direct: async ({ message, next }) => {
        if (
            message.channel_type == DIRECT ||
            message.channel_type == MULTI_DIRECT
        ) await next();
    },

    selective: async ({ message, next }) => {
        if (
            message.channel_type == PRIVATE_CHANNEL ||
            message.channel_type == DIRECT ||
            message.channel_type == MULTI_DIRECT
        ) await next();
    },

    community: async ({ message, next }) => {
        if (
          message.channel_type == CHANNEL ||
          message.channel_type == PRIVATE_CHANNEL ||
          message.channel_type == MULTI_DIRECT
        ) await next();
    },

    anywhere: async ({ message, next }) => {
        if (
          message.channel_type == CHANNEL ||
          message.channel_type == PRIVATE_CHANNEL ||
          message.channel_type == DIRECT ||
          message.channel_type == MULTI_DIRECT
        ) await next();
    }
}
