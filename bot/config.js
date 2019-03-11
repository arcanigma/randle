module.exports = {
    HEAR_DIRECTLY: ['direct_message'],
    HEAR_EXPLICIT: ['direct_message', 'direct_mention', 'mention'],
    HEAR_ANYWHERE: ['direct_message', 'direct_mention', 'mention', 'ambient'],
    MAX_ATTACH: 20,
    MAX_RESPONSE: 2000,
    CACHE_TTL: 86400, // 24 hours
    CACHE_CHECK_PERIOD: 10800 // 3 hours
};
