module.exports = {
    HEAR_DIRECTLY: ['direct_message'],
    HEAR_EXPLICIT: ['direct_message', 'direct_mention', 'mention'],
    HEAR_ANYWHERE: ['direct_message', 'direct_mention', 'mention', 'ambient'],
    IGNORE_THREADS: true,
    MAX_ATTACH: 20,
    MAX_MESSAGE: 1000,
    CACHE_TTL: 1800, // 30 minutes
    CACHE_CHECK_PERIOD: 10800 // 3 hours
};
