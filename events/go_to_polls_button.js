module.exports = ({ app }) => {
    app.action('go_to_polls_button', async ({ ack }) => {
        await ack();
    });
};
