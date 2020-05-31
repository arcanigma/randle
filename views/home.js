const { list_macros } = require('../views/macros.js'),
      { list_polls } = require('../views/polls.js');

const divider = {
    type: 'divider'
};

// TODO 100 block error; select from macros, filtered polls, etc
const home_view = async ({ user, store, options={} }) => {
    let blocks = [
        ...await list_polls({ user, store, options: options.polls }),
        divider,
        ...await list_macros({ user, store }),
        divider
    ].slice(0, 100);

    let view = {
        type: 'home',
        blocks: blocks
    };

    return JSON.stringify(view);
};

module.exports = {
    home_view
};
