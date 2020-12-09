import { App, BlockAction, Context, InteractiveMessage, SlackAction, SlackViewAction, ViewSubmitAction } from '@slack/bolt';
import { ActionsBlock, Block, ChatPostMessageArguments, ContextBlock, MrkdwnElement, SectionBlock, WebAPICallResult, WebClient } from '@slack/web-api';
import { MongoClient, ObjectID } from 'mongodb';
import { Cache } from '../app';
import { commas, names, offbox, onbox } from '../library/factory';
import * as information_modal from '../library/information_modal';
import * as create_poll_modal from './create_poll_modal';
import * as create_poll_shortcut from './create_poll_shortcut';
import * as poll_interactions from './poll_interactions';

// TODO slash polls with macros
// TODO TTL for closed polls

export const AUTOCLOSE_GRACE = 30;

export type Poll = {
    _id?: ObjectID;
    opened: Date;
    closed?: Date;
    host: string;
    audience: string;
    members: string[];
    prompt: string;
    choices: string[];
    method: 'anonymous' | 'simultaneous' | 'live';
    autoclose: boolean;
    votes: {
        [user: string]: number;
    };
    latest?: {
        summary: string;
        message_ts: string;
        permalink: string;
    };
};

const re_emoji = /(:[^:\s]*(?:::[^:\s]*)*:)/g;
export async function announce ({ mode, poll, context, body, client, store }:
    { mode: string; poll: Poll; context: Context; body: SlackAction | SlackViewAction; client: WebClient; store: Promise<MongoClient> }
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
        }[mode]} the poll *${poll.prompt}*`;

        const team_id = body.team ? body.team.id : '',
            app_id = (<ViewSubmitAction|BlockAction>body).api_app_id ?? '';

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
                url: `slack://app?team=${team_id}&id=${app_id}&tab=home`,
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
                    text: `*About:* ${commas([
                        {
                            'anonymous': 'anonymous poll',
                            'simultaneous': 'simultaneous poll',
                            'live': 'live poll'
                        }[poll.method],
                        poll.autoclose ? 'autoclose' : undefined
                    ])}`
                }
            ]
        });
    }
    else if (mode == 'participate') {
        if (poll.votes[user] === undefined)
            summary = `<@${user}> unvoted`;
        else if (poll.method != 'live')
            summary = `<@${user}> voted`;
        else
            summary = `<@${user}> voted for *${poll.choices[poll.votes[user]]}*`;

        const counts = [];

        if (poll.method == 'live')
            counts.push(...poll.choices.map((choice, index) => {
                const cohort = poll.members.filter(member => poll.votes[member] === index);
                return cohort.length > 0 ? {
                    type: 'mrkdwn',
                    text: `*${choice}:* *${cohort.length}* ${onbox(cohort.length)}`
                } : undefined;
            }).filter(element => element !== undefined));
        else if (voted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Voted* *${voted.length}* ${onbox(voted.length)}`
            });

        if (unvoted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Not Voted:* *${unvoted.length}* ${offbox(unvoted.length)}`
            });

        if (counts.length > 0)
            blocks.push(<ContextBlock>{
                type: 'context',
                elements: counts
            });
    }
    else if (mode == 'close' || mode == 'autoclose') {
        if (mode != 'autoclose')
            summary = `<@${poll.host}> closed the poll *${poll.prompt}*`;
        else
            summary = `<@${<string> context.botUserId}> closed the poll *${poll.prompt}* for <@${poll.host}>`;

        const counts = [];

        counts.push(...poll.choices.map((choice, index) => {
            const cohort = poll.members.filter(member => poll.votes[member] === index);
            return cohort.length > 0 ? {
                type: 'mrkdwn',
                text: `*${choice}:* *${cohort.length}* ${onbox(cohort.length)}${poll.method != 'anonymous' ? ` (${names(cohort)})` : ''}`
            } : undefined;
        }).filter(element => element !== undefined));

        if (poll.method == 'anonymous' && voted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Voted Anonymously:* *${voted.length}* (${names(voted)})`
            });

        if (unvoted.length > 0)
            counts.push(<MrkdwnElement>{
                type: 'mrkdwn',
                text: `*Not Voted:* *${unvoted.length}* ${offbox(unvoted.length)} (${names(unvoted)})`
            });

        if (counts.length > 0)
            blocks.push(<ContextBlock>{
                type: 'context',
                elements: counts
            });
    }
    else if (mode == 'abort') {
        summary = `<@${poll.host}> aborted the poll *${poll.prompt}*`;
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
        token: <string> context.botToken,
        channel: poll.audience,
        username: `Poll: ${poll.prompt.replace(re_emoji, '')}`,
        icon_emoji: ':ballot_box_with_ballot:',
        text: summary.replace(/\*/g, ''),
        blocks: blocks
    };

    let ts: string;
    try {
        ts = ((
            await client.chat.postMessage(message)
        ) as WebAPICallResult & {
            ts: string;
        }).ts;
    }
    catch (error) {
        if ((<{ data: { error: string } }> error).data.error == 'not_in_channel') {
            await client.conversations.join({
                token: <string> context.botToken,
                channel: poll.audience
            });

            await client.views.open({
                token: <string> context.botToken,
                trigger_id: (<InteractiveMessage>body).trigger_id,
                view: information_modal.view({
                    title: 'Notice',
                    error: `<@${<string> context.botUserId}> automatically joined the <#${poll.audience}> channel.`
                })
            });

            ts = ((
                await client.chat.postMessage(message)
            ) as WebAPICallResult & {
                ts: string;
            }).ts;
        }
        else throw error;
    }

    const permalink = ts ? (await client.chat.getPermalink({
        channel: poll.audience,
        message_ts: ts
    })).permalink : undefined;

    const coll = (await store).db().collection('polls');
    await coll.updateOne(
        { _id: new ObjectID(poll._id) },
        ts ? { $set: {
            latest: {
                summary: summary,
                message_ts: ts,
                permalink: permalink
            }
        } } : { $unset: {
            latest: undefined
        } }
    );
}

export const register = ({ app, store, cache, timers }: { app: App; store: Promise<MongoClient>; cache: Cache; timers: Record<string, NodeJS.Timeout> }): void => {
    [ create_poll_modal, create_poll_shortcut, poll_interactions ].forEach(it => {
        it.register({ app, store, cache, timers });
    });
};
