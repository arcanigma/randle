module.exports = ({ app, store }) => {
    require('../events/edit_macro_button.js')({ app, store });
    require('../events/edit_macro_modal.js')({ app, store });
};
