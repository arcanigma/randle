module.exports = {

    HEAR_DIRECTLY: ['direct_message'],
    HEAR_EXPLICIT: ['direct_message', 'direct_mention', 'mention'],
    HEAR_ANYWHERE: ['direct_message', 'direct_mention', 'mention', 'message'],

    MAX_REPLY_SIZE: 5000

    // TODO: refactor when caching is enabled
    // CACHE_TTL: 86400, // 24 hours
    // CACHE_CHECK_PERIOD: 10800 // 3 hours

};
