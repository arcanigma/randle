const { list_macros } = require('../views/macros.js');

const divider = {
    type: 'divider'
};

const home_view = async (store, user) => {
    let blocks = [
        ...await list_macros(store, user),
        divider
    ];

    let view = {
        type: 'home',
        blocks: blocks
    }

    return JSON.stringify(view);
};

module.exports = {
    home_view
}
