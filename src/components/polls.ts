import { App, Context, InteractiveMessage, SlackAction, SlackViewAction, BlockAction, ViewSubmitAction  } from '@slack/bolt';
import { Block, SectionBlock, ContextBlock, MrkdwnElement, ActionsBlock, WebClient, ChatPostMessageArguments, WebAPICallResult } from '@slack/web-api';
import { MongoClient, ObjectID } from 'mongodb';

import { commas, names, onbox, offbox } from '../library/factory';

import informative_modal from '../views/informative_modal';
import create_poll_modal from '../events/create_poll_modal';
import create_poll_shortcut from '../events/create_poll_shortcut';
import filter_polls_select from '../events/filter_polls_select';
import poll_overflow_button from '../events/poll_overflow_button';
import vote_button from '../events/vote_button';

export default (app: App, store: Promise<MongoClient>): void => {
    const timers: Timers = {};

    create_poll_modal(app, store);
    create_poll_shortcut(app);
    filter_polls_select(app, store);
    poll_overflow_button(app, store, timers);
    vote_button(app, store, timers);
};

export type Poll = {
    _id?: ObjectID;
    opened: Date;
    closed?: Date;
    host: string;
    audience: string;
    members: string[];
    prompt: string;
    choices: string[];
    setup: PollSetupOptions[];
    votes: {
        [user: string]: number
    };
    latest?: {
        summary: string,
        message_ts: string,
        permalink: string;
    };
};

export enum PollSetupOptions {
    Anonymous = 'anonymous',
    Participation = 'participation',
    Autoclose = 'autoclose'
}

export type Timers = {
    [poll: string]: NodeJS.Timeout;
};

export async function announce(
    mode: string,
    poll: Poll,
    context: Context,
    body: SlackAction | SlackViewAction,
    client: WebClient,
    store: Promise<MongoClient>
): Promise<void> {
    const user = body.user.id,
    voted = poll.members.filter(member => poll.votes[member] !== undefined),
        unvoted = poll.members.filter(member => poll.votes[member] === undefined);

    let summary;

    const blocks: Block[] = [];

    if (mode == 'open' || mode == 'reopen' || mode == 'reannounce') {
        summary = `<@${poll.host}> ${{
            open: 'opened',
            reopen: 'reopened',
            reannounce: 'reannounced'
        }[mode]} the poll`;

        blocks.push(<ActionsBlock>{
            type: 'actions',
            elements: poll.choices.map((choice, index) => ({
                type: 'button',
                action_id: `vote_button_${index}`,
                text: {
                    type: 'plain_text',
                    emoji: true,
                    text: choice
                },
                url: `slack://app?team=${body.team.id}&id=${(<ViewSubmitAction|BlockAction>body).api_app_id}&tab=home`,
                value: JSON.stringify({
                    poll: poll._id,
                    choice: index
                })
            }))
        });

        blocks.push(<ContextBlock>{
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `*Members:* ${names(poll.members)}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Setup:* ${commas(poll.setup.map(option => ({
                        participation: 'participation notices',
                        anonymous: 'anonymous voting',
                        autoclose: 'automatic closing'
                    })[option])) || 'default'}`
                }
            ]
        });
    }
    else if (mode == 'participate') {
        summary = `<@${user}> ${poll.votes[user] !== undefined ? 'voted' : 'unvoted'}`;

        const counts = [];
        if (voted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Voted:* ${onbox(voted.length)} *${voted.length}*`
            });
        if (unvoted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Not Voted:* ${offbox(unvoted.length)} *${unvoted.length}*`
            });
        if (counts.length > 0)
            blocks.push(<ContextBlock>{
                type: 'context',
                elements: counts
            });
    }
    else if (mode == 'close' || mode == 'autoclose') {
        summary = mode == 'close'
            ? `<@${poll.host}> closed the poll`
            : `<@${context.botUserId}> closed the poll for <@${poll.host}>`;

        blocks.push(<ContextBlock>{
            type: 'context',
            elements: poll.choices.map((choice, index) => {
                const cohort = poll.members.filter(member => poll.votes[member] === index);
                return cohort.length > 0 ? {
                    type: 'mrkdwn',
                    text: `*${choice}:* ${onbox(cohort.length)} *${cohort.length}*${!poll.setup.includes(PollSetupOptions.Anonymous) ? ` (${names(cohort)})` : ''}`
                } : undefined;
            }).filter(element => element !== undefined)
        });

        const counts = [];
        if (poll.setup.includes(PollSetupOptions.Anonymous) && voted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Voted Anonymously:* *${voted.length}* (${names(voted)})`
            });
        if (unvoted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Not Voted:* ${offbox(unvoted.length)} *${unvoted.length}* (${names(unvoted)})`
            });
        if (counts.length > 0)
            blocks.push(<ContextBlock>{
                type: 'context',
                elements: counts
            });
    }
    else {
        throw 'Unsupported poll announcement mode.';
    }

    blocks.unshift(<SectionBlock>{
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: summary
        }
    });

    const message: ChatPostMessageArguments = {
        token: context.botToken,
        channel: poll.audience,
        username: `Poll: ${poll.prompt}`,
        icon_emoji: ':ballot_box_with_ballot:',
        text: summary,
        blocks: blocks
    };

    let ts: string;
    try {
        ts = ((
            await client.chat.postMessage(message)
        ) as WebAPICallResult & {
            ts: string
        }).ts;
    }
    catch (err) {
        if (err.data.error == 'not_in_channel') {
            await client.conversations.join({
                token: context.botToken,
                channel: poll.audience
            });

            await client.views.open({
                token: context.botToken,
                trigger_id: (<InteractiveMessage>body).trigger_id,
                view: await informative_modal({
                    title: 'Notice',
                    error: `<@${context.botUserId}> automatically joined the <#${poll.audience}> channel.`
                })
            });

            ts = ((
                await client.chat.postMessage(message)
            ) as WebAPICallResult & {
                ts: string
            }).ts;
        }
        else throw err;
    }

    const permalink = ts ? (await client.chat.getPermalink({
        channel: poll.audience,
        message_ts: ts
    })).permalink : undefined;

    const coll = (await store).db().collection('polls');
    await coll.updateOne(
        { _id: new ObjectID(poll._id) },
        ts
            ? { $set: {
                latest: {
                    summary: summary,
                    message_ts: ts,
                    permalink: permalink
                }
            } }
            : { $unset: {
                latest: undefined
            } }
    );
}
