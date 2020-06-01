const list_macros_blocks = require('./list_macros_blocks.js'),
      list_polls_blocks = require('./list_polls_blocks.js');

/*
    TODO 100 block error

    selection menu:
        open polls
        closed polls
        all polls
        macros
    remember selection
*/
module.exports = async ({ user, store, options={} }) => {
    let blocks = [
        ...await list_polls_blocks({ user, store, options: options.polls }),
        { type: 'divider' },
        ...await list_macros_blocks({ user, store }),
        { type: 'divider' }
    ].slice(0, 100);

    let view = {
        type: 'home',
        blocks: blocks
    };

    return JSON.stringify(view);
};
