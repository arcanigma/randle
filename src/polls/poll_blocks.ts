import { App, ButtonAction, InteractiveMessage, StaticSelectAction } from '@slack/bolt';
import { ActionsBlock, Block, ContextBlock, SectionBlock } from '@slack/web-api';
import { MongoClient, ObjectID } from 'mongodb';
import * as home from '../home';
import { HomeOptions, PollFilterOptions } from '../home';
import { commas, names, size } from '../library/factory';
import * as information_modal from '../library/information_modal';
import { announce, AUTOCLOSE_GRACE, Poll, PollSetupOptions } from './polls';

export const blocks = async (user: string, poll: Poll, options: HomeOptions): Promise<Block[]> => {
    const voted = poll.members.filter(member => poll.votes[member] !== undefined),
        unvoted = poll.members.filter(member => poll.votes[member] === undefined);

    const blocks: Block[] = [
        <SectionBlock>{
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${poll.prompt}*`
            }
        },
        <ContextBlock>{
            type: 'context',
            elements: [
                ...(options.polls.filter == PollFilterOptions.All ? [{
                    type: 'mrkdwn',
                    text: `*Status:* ${poll.closed !== undefined ? 'closed' : 'open'}`
                }] : []),
                {
                    type: 'mrkdwn',
                    text: `*Audience:* <#${poll.audience}>`
                },
                ...(poll.votes[user] !== undefined ? [{
                    type: 'mrkdwn',
                    text: `*You Voted:* ${poll.choices[poll.votes[user]]}`
                }] : []),
                ...(poll.latest ? [{
                    type: 'mrkdwn',
                    text: `*Latest:* ${poll.latest.summary} <!date^${parseInt(poll.latest.message_ts)}^{date_short_pretty} at {time}^${poll.latest.permalink}|there>`
                }] : [])
            ]
        },
        <ActionsBlock>{
            type: 'actions',
            elements: [
                ...(poll.choices.map((choice, index) =>
                    ({
                        type: 'button',
                        action_id: `vote_button_${index}`,
                        text: {
                            type: 'plain_text',
                            emoji: true,
                            text: choice
                        },
                        ...(poll.votes[user] === index ? {
                            style: !poll.closed ? 'primary' : 'danger'
                        } : !poll.members.includes(user) ? {
                            style: 'danger'
                        } : {}),
                        value: JSON.stringify({
                            poll: poll._id,
                            choice: poll.votes[user] != index ? index : null
                        })
                    })
                )),
                ...(poll.host == user ? [{
                    type: 'overflow',
                    action_id: 'poll_overflow_button',
                    options: [
                        ...(!poll.closed ? [
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Close Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'close'
                                })
                            },
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Abort Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'abort'
                                })
                            },
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Reannounce Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'reannounce'
                                })
                            }
                            // TODO edit with "edited" warning
                        ] : [
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Reopen Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'reopen'
                                })
                            },
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Delete Poll'
                                },
                                value: JSON.stringify({
                                    poll: poll._id,
                                    admin: 'delete'
                                })
                            }
                        ]),
                    ],
                    confirm: {
                        title: {
                            type: 'plain_text',
                            text: 'Warning'
                        },
                        text: {
                            type: 'plain_text',
                            text: 'You might not be able to change your mind later.'
                        },
                        confirm: {
                            type:'plain_text',
                            text:'Proceed'
                        },
                        deny: {
                            type:'plain_text',
                            text:'Cancel'
                        }
                      }
                }] : [])
            ]
        },
        <ContextBlock>{
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `*Host:* ${poll.host != user ? `<@${poll.host}>` : 'you'}`
                },
                ...(user == poll.host || poll.setup.includes(PollSetupOptions.Participation) ? [
                    ...(voted.length > 0 ? [{
                        type: 'mrkdwn',
                        text: `*Voted:* ${names(voted, user)}`
                    },] : []),
                    ...(unvoted.length > 0 ? [{
                        type: 'mrkdwn',
                        text: `*Not Voted:* ${names(unvoted, user)}`
                    }] : [])
                ] : [{
                    type: 'mrkdwn',
                    text: `*Members:* ${names(poll.members, user)}`
                }]),
                ...(poll.setup ? [{
                    type: 'mrkdwn',
                    text: `*Setup:* ${commas(poll.setup.map(option => ({
                        participation: 'participation notices',
                        anonymous: 'anonymous voting',
                        autoclose: 'automatic closing'
                    })[option])) || 'default'}`
                }] : [])
            ]
        }
    ];

    return blocks;
};

export const events = (app: App, store: Promise<MongoClient>, timers: Record<string, NodeJS.Timeout>): void => {
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
        if (data.admin == 'close' || data.admin == 'abort') {
            const poll: Poll = (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(data.poll),
                    host: user
                },
                { $set: { closed: new Date() } }
            )).value;

            await announce(data.admin, poll, context, body, client, store);

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
            view: await home.view(user, store, { polls: { filter } })
        });
    });

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
                        view: await information_modal.view({
                            title: 'Warning',
                            error: `You voted last. The poll automatically closes after *${AUTOCLOSE_GRACE} seconds* unless somebody votes or unvotes before then.`
                        })
                    });
                }
            }

            await client.views.publish({
                token: context.botToken,
                user_id: user,
                view: await home.view(user, store)
            });
        }
        else {
            await client.views.open({
                token: context.botToken,
                trigger_id: (body as InteractiveMessage).trigger_id,
                view: await information_modal.view({
                    title: 'Error',
                    error: "You can't vote in this poll."
                })
            });
        }
    });
};
