import { App, ButtonAction, InteractiveMessage } from '@slack/bolt';
import { ObjectID, MongoClient } from 'mongodb';

import { size } from '../library/factory';
import { announce, Poll, PollSetupOptions, Timers } from '../components/polls';

import informative_modal from '../views/informative_modal';
import app_home from '../views/app_home';

export default (app: App, store: Promise<MongoClient>, timers: Timers): void => {
    const AUTOCLOSE_GRACE = 30;

    app.action(/^vote_button_\d+$/, async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id,
            data = JSON.parse((action as ButtonAction).value);

        const coll = (await store).db().collection('polls');
        const poll: Poll = (await coll.findOneAndUpdate(
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

        if (poll) {
            if (poll.setup.includes(PollSetupOptions.Participation))
                await announce('participate', poll, context, body, client, store);

            if (poll.setup.includes(PollSetupOptions.Autoclose)) {
                if (timers[data.poll]) {
                    clearTimeout(timers[data.poll]);
                    delete timers[data.poll];
                }

                if (size(poll.votes) == poll.members.length) {
                    timers[data.poll] = setTimeout(async () => {
                        delete timers[data.poll];

                        const poll: Poll = (await coll.findOne({
                            _id: new ObjectID(data.poll)
                        }))!;

                        if (size(poll.votes) == poll.members.length) {
                            await coll.updateOne(
                                { _id: new ObjectID(data.poll) },
                                { $set: { closed: new Date() } }
                            );

                            await announce('autoclose', poll, context, body, client, store);
                        }
                    }, AUTOCLOSE_GRACE * 1000);

                    await client.views.open({
                        token: context.botToken,
                        trigger_id: (body as InteractiveMessage).trigger_id,
                        view: await informative_modal({
                            title: 'Warning',
                            error: `You voted last. The poll automatically closes after *${AUTOCLOSE_GRACE} seconds* unless somebody votes or unvotes before then.`
                        })
                    });
                }
            }

            await client.views.publish({
                token: context.botToken,
                user_id: user,
                view: await app_home(user, store)
            });
        }
        else {
            await client.views.open({
                token: context.botToken,
                trigger_id: (body as InteractiveMessage).trigger_id,
                view: await informative_modal({
                    title: 'Error',
                    error: "You can't vote in this poll."
                })
            });
        }
    });
};
