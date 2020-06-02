import { App, StaticSelectAction } from '@slack/bolt';
import { MongoClient, ObjectID } from 'mongodb';

import { announce, Poll, Timers } from '../components/polls';
import { PollFilterOptions } from '../views/app_home';

import app_home from '../views/app_home';

export default (app: App, store: Promise<MongoClient>, timers: Timers): void => {
    app.action('poll_overflow_button', async ({ ack, body, action, context, client }) => {
        await ack();

        const user = body.user.id,
            data = JSON.parse((action as StaticSelectAction).selected_option.value);

        if (timers[data.poll]) {
            clearTimeout(timers[data.poll]);
            delete timers[data.poll];
        }

        const coll = (await store).db().collection('polls');

        let filter;
        if (data.admin == 'close') {
            const poll: Poll = (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                { $set: { closed: new Date() } }
            )).value;

            await announce('close', poll, context, body, client, store);

            filter = PollFilterOptions.Closed;
        }
        else if (data.admin == 'reannounce') {
            const poll: Poll = (await coll.findOne({
                _id: new ObjectID(data.poll),
                host: user
            }))!;

            await announce('reannounce', poll, context, body, client, store);

            filter = PollFilterOptions.Open;
        }
        else if (data.admin == 'reopen') {
            const poll: Poll = (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                {
                    $set: { opened: new Date() },
                    $unset: { closed: undefined }
                }
            )).value;

            await announce('reopen', poll, context, body, client, store);

            filter = PollFilterOptions.Open;
        }
        else if (data.admin == 'delete') {
            await coll.deleteOne({
                _id: new ObjectID(data.poll),
                host: user,
                closed: { $exists: true }
            });

            filter = PollFilterOptions.Closed;
        }
        else {
            throw `Unsupported poll administration option \`${data.admin}\`.`;
        }

        await client.views.publish({
            token: context.botToken,
            user_id: user,
            view: await app_home(user, store, { polls: { filter } })
        });
    });
};
