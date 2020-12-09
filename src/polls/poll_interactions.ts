import { App, BlockAction, ButtonAction, StaticSelectAction } from '@slack/bolt';
import { MongoClient, ObjectID } from 'mongodb';
import { Cache } from '../app';
import * as home from '../home';
import { size } from '../library/factory';
import * as information_modal from '../library/information_modal';
import { announce, AUTOCLOSE_GRACE, Poll } from './polls';

export const register = ({ app, store, cache, timers }: { app: App; store: Promise<MongoClient>; cache: Cache; timers: Record<string, NodeJS.Timeout> }): void => {
    app.action<BlockAction<StaticSelectAction>>('poll_overflow_button', async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id,
            data = JSON.parse(action.selected_option.value) as {
                poll: string;
                admin: string;
            };

        if (timers[data.poll]) {
            clearTimeout(timers[data.poll]);
            delete timers[data.poll];
        }

        const coll = (await store).db().collection('polls');

        if (data.admin == 'close' || data.admin == 'abort') {
            const poll = <Poll> (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                { $set: { closed: new Date() } }
            )).value;

            await announce({ mode: data.admin, poll, context, body, client, store });

            cache[`${user}/home_tab`] = 'polls-closed';
        }
        else if (data.admin == 'reannounce') {
            const poll = <Poll> (await coll.findOne({
                _id: new ObjectID(data.poll),
                host: user
            }));

            await announce({ mode: 'reannounce', poll, context, body, client, store });
        }
        else if (data.admin == 'reopen') {
            const poll = <Poll> (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                {
                    $set: { opened: new Date() },
                    $unset: { closed: undefined }
                }
            )).value;

            await announce({ mode: 'reopen', poll, context, body, client, store });

            cache[`${user}/home_tab`] = 'polls-open';
        }
        else if (data.admin == 'delete') {
            await coll.deleteOne({
                _id: new ObjectID(data.poll),
                host: user,
                closed: { $exists: true }
            });
        }
        else {
            throw `Unsupported poll administration option \`${JSON.stringify(data.admin)}\`.`;
        }

        await client.views.publish({
            token: <string> context.botToken,
            user_id: user,
            view: await home.view({ user, store, cache, context })
        });
    });

    app.action<BlockAction<ButtonAction>>(/^vote_button_\d+$/, async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id,
            data = JSON.parse(action.value) as {
                poll: string;
                choice: number;
            };

        const coll = (await store).db().collection('polls');
        const poll = <Poll> (await coll.findOneAndUpdate(
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
            await announce({ mode: 'participate', poll, context, body, client, store });

            if (poll.autoclose) {
                if (timers[data.poll]) {
                    clearTimeout(timers[data.poll]);
                    delete timers[data.poll];
                }

                if (size(poll.votes) == poll.members.length) {
                    timers[data.poll] = setTimeout(() => {
                        void (async () => {
                            delete timers[data.poll];

                            const poll = <Poll> (await coll.findOne({
                                _id: new ObjectID(data.poll)
                            }));

                            if (size(poll.votes) == poll.members.length) {
                                await coll.updateOne(
                                    { _id: new ObjectID(data.poll) },
                                    { $set: { closed: new Date() } }
                                );

                                await announce({ mode: 'autoclose', poll, context, body, client, store });
                            }
                        })();
                    }, AUTOCLOSE_GRACE * 1000);

                    await client.views.open({
                        token: <string> context.botToken,
                        trigger_id: body.trigger_id,
                        view: information_modal.view({
                            title: 'Warning',
                            error: `You voted last. The poll automatically closes after *${AUTOCLOSE_GRACE} seconds* unless somebody votes or unvotes before then.`
                        })
                    });
                }
            }

            cache[`${user}/home_tab`] = 'polls-open';

            await client.views.publish({
                token: <string> context.botToken,
                user_id: user,
                view: await home.view({ user, store, cache, context })
            });
        }
        else {
            await client.views.open({
                token: <string> context.botToken,
                trigger_id: body.trigger_id,
                view: information_modal.view({
                    title: 'Error',
                    error: "You can't vote in this poll."
                })
            });
        }
    });
};
