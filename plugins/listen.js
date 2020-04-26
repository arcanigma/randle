const CHANNEL = 'channel',
      PRIVATE_CHANNEL = 'group',
      DIRECT = 'im',
      MULTI_DIRECT = 'mpim';

const debug = async ({ message, context, next }) => {
    console.log({
        message: message,
        context: context
    });
    await next();
};

const nonthread = async ({ message, next }) => {
    if (!message.thread_ts)
        await next();
};

const direct = async ({ message, next }) => {
    const where = [DIRECT];
    if (where.includes(message.channel_type))
        await next();
};

const community = async ({ message, next }) => {
    const where = [CHANNEL, PRIVATE_CHANNEL, MULTI_DIRECT];
    if (where.includes(message.channel_type))
        await next();
};

const anywhere = async ({ message, next }) => {
    const where = [CHANNEL, PRIVATE_CHANNEL, MULTI_DIRECT, DIRECT];
    if (where.includes(message.channel_type))
        await next();
};

const botless = async ({ message, next }) => {
  if (message.subtype != 'bot_message' && !message.bot_id && !message.bot_profile)
      await next();
}

module.exports = {
    debug,
    nonthread,
    direct,
    community,
    anywhere,
    botless
};
