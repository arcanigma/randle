const { ObjectID } = require('mongodb');

const { size } = require('../library/factory.js'),
      informative_modal = require('../views/informative_modal.js'),
      app_home = require('../views/app_home.js');

module.exports = ({ app, store, announce, timers }) => {
    const AUTOCLOSE_GRACE = 30;

    app.action(/^vote_button_\d+_open$/, async ({ ack, body, action, context, client }) => {
        await ack();

        let user = body.user.id,
            data = JSON.parse(action.value);

        let coll = (await store).db().collection('polls');
        let poll = (await coll.findOneAndUpdate(
            {
                _id: new ObjectID(data.poll),
                members: { $in: [user] },
                closed: { $exists: false }
            },
            data.choice !== null
                ? { $set: { [`votes.${user}`]: data.choice } }
                : { $unset: { [`votes.${user}`]: undefined } },
            { returnOriginal: false }
        )).value;

        if (poll.setup.includes('participation'))
            await announce({ context, body, poll, client, mode: 'participate' });

        if (poll.setup.includes('autoclose')) {
            if (timers[data.poll]) {
                clearTimeout(timers[data.poll]);
                delete timers[data.poll];
            }

            if (size(poll.votes) == poll.members.length) {
                timers[data.poll] = setTimeout(async () => {
                    delete timers[data.poll];

                    poll = (await coll.findOne({
                        _id: new ObjectID(data.poll)
                    }));

                    if (size(poll.votes) == poll.members.length) {
                        await coll.updateOne(
                            { _id: new ObjectID(data.poll) },
                            { $set: { closed: new Date() } }
                        );

                        await announce({ context, body, poll, client, mode: 'autoclose' });
                    }
                }, AUTOCLOSE_GRACE * 1000);

                let modal = await informative_modal({ context, client,
                    title: 'Warning',
                    error: `You cast the last vote. The poll automatically closes within *${AUTOCLOSE_GRACE} seconds* if no votes are recast or uncast.`
                });

                await client.views.open({
                    token: context.botToken,
                    trigger_id: body.trigger_id,
                    view: modal
                });
            }
        }

        let home = await app_home({ user, store });

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: home
        });
    });

    app.action(/^vote_button_\d+_(?:closed|nonmember)$/, async ({ ack, body, action, context, client }) => {
        await ack();

        let modal = await informative_modal({ context, client,
            title: 'Error',
            error: action.action_id.endsWith('closed')
                ? "You can't vote in a closed poll."
                : "You can't vote if you're not a member of the poll, even if you're the host."
        });

        await client.views.open({
            token: context.botToken,
            trigger_id: body.trigger_id,
            view: modal
        });
    });
};
