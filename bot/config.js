module.exports = {
    HEAR_ANYWHERE: ['direct_message', 'direct_mention', 'mention', 'ambient'],
    HEAR_EXPLICIT: ['mention', 'direct_message', 'direct_mention'],
    IGNORE_THREADS: true,
    MAX_ATTACH: 20,
    MAX_MESSAGE: 1000,
    CACHE_TTL: 1800, // 30 minutes
    CACHE_CHECK_PERIOD: 10800 // 3 hours
};
