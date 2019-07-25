module.exports = {

    DATABASE: 'randle',
    // CONVERSATION_STATE: 'conversation',
    USER_STATE: 'user',

    HEAR_DIRECTLY: ['direct_message'],
    HEAR_EXPLICIT: ['direct_message', 'direct_mention', 'mention'],
    HEAR_ANYWHERE: ['direct_message', 'direct_mention', 'mention', 'message'],

    MAX_REPLY_SIZE: 5000

};
