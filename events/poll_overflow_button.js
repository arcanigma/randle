const { ObjectID } = require('mongodb');

const app_home = require('../views/app_home.js');

module.exports = ({ app, store, announce, timers }) => {
    app.action('poll_overflow_button', async ({ ack, body, action, context, client }) => {
        await ack();

        let user = body.user.id,
            data = JSON.parse(action.selected_option.value);

        if (timers[data.poll]) {
            clearTimeout(timers[data.poll]);
            delete timers[data.poll];
        }

        let options;
        if (data.admin == 'close') {
            let coll = (await store).db().collection('polls');
            let poll = (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                { $set: { closed: new Date() } }
            )).value;

            await announce({ context, body, poll, client, mode: 'close' });

            options = { polls: { filter: 'closed' } };
        }
        else if (data.admin == 'reannounce') {
            let coll = (await store).db().collection('polls');
            let poll = (await coll.findOne({
                _id: new ObjectID(data.poll),
                host: user
            }));

            await announce({ context, body, poll, client, mode: 'reannounce' });

            options = { polls: { filter: 'open' } };
        }
        else if (data.admin == 'reopen') {
            let coll = (await store).db().collection('polls');
            let poll = (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                {
                    $set: { opened: new Date() },
                    $unset: { closed: undefined }
                }
            )).value;

            await announce({ context, body, poll, client, mode: 'reopen' });

            options = { polls: { filter: 'open' } };
        }
        else if (data.admin == 'delete') {
            let coll = (await store).db().collection('polls');
            await coll.deleteOne({
                _id: new ObjectID(data.poll),
                host: user,
                closed: { $exists: true }
            });

            options = { polls: { filter: 'closed' } };
        }

        let home = await app_home({ user, store, options });

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: home
        });
    });
};
