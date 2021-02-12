import { App, ButtonAction, ChannelsSelectAction, CheckboxesAction, Context, MultiStaticSelectAction, MultiUsersSelectAction, StaticSelectAction } from '@slack/bolt';
import { InputBlock, SectionBlock, View, WebAPICallResult, WebClient } from '@slack/web-api';
import { MongoClient, ObjectID, ObjectId } from 'mongodb';
import { Cache } from '../app';
import { shuffleCopy } from '../deck/solving';
import * as home from '../home';
import { size, trunc } from '../library/factory';
import { announce, Poll } from './polls';

export const view = async ({ channel, poll, context, client }: { channel?: string | undefined; poll?: Poll; context: Context; client: WebClient }): Promise<View> => ({
    type: 'modal',
    callback_id: 'create_edit_poll_modal',
    private_metadata: !poll ? 'new' : poll._id?.toHexString(),
    title: {
        type: 'plain_text',
        text: !poll
            ? 'Create a poll'
            : 'Edit a poll'
    },
    submit: {
        type: 'plain_text',
        text: !poll
            ? 'Create'
            : 'Edit'
    },
    close: {
        type: 'plain_text',
        text: 'Cancel'
    },
    blocks: [
        ...(poll ? [
            <SectionBlock>{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: ':warning: *Warning:* If you edit the poll in any way, all votes will be reset.'
                }
            }
        ]: []),
        <InputBlock>{
            type: 'input',
            block_id: 'audience',
            label: {
                type: 'plain_text',
                text: 'Audience'
            },
            hint: {
                type: 'plain_text',
                text: 'The channel where the poll is announced.'
            },
            element: {
                type: 'channels_select',
                action_id: 'input',
                placeholder: {
                    type: 'plain_text',
                    text: 'Select a channel'
                },
                ...(channel || poll ? {
                    initial_channel: !poll ? channel : poll.audience
                } : {})
            }
        },
        <InputBlock>{
            type: 'input',
            block_id: 'members',
            label: {
                type: 'plain_text',
                text: 'Members'
            },
            hint: {
                type: 'plain_text',
                text: 'The users who can participate (not restricted to the audience).'
            },
            element: {
                type: 'multi_users_select',
                action_id: 'input',
                placeholder: {
                    type: 'plain_text',
                    text: 'Select users'
                },
                initial_users:
                    channel ? (
                        (await client.conversations.members({
                            token: <string> context.botToken,
                            channel: channel
                        }) as WebAPICallResult & {
                            members: string[];
                        }).members.filter(user => user != context.botUserId)
                    ) : poll ? poll.members : []
            }
        },
        <InputBlock>{
            type: 'input',
            block_id: 'prompt',
            label: {
                type: 'plain_text',
                text: 'Prompt'
            },
            hint: {
                type: 'plain_text',
                text: 'The question or statement members vote on (no formatting, emoji okay).'
            },
            element: {
                type: 'plain_text_input',
                action_id: 'input',
                placeholder: {
                    type: 'plain_text',
                    text: 'Question or statement'
                },
                min_length: 5,
                max_length: 300,
                ...(poll ? {
                    initial_value: poll.prompt
                } : {})
            }
        },
        <InputBlock>{
            type: 'input',
            optional: true,
            block_id: 'choices',
            label: {
                type: 'plain_text',
                text: 'Choices'
            },
            hint: {
                type: 'plain_text',
                text: 'The choices members can vote for (one per line, no formatting, emoji okay).'
            },
            element: {
                type: 'plain_text_input',
                action_id: 'input',
                multiline: true,
                placeholder: {
                    type: 'plain_text',
                    text: 'One choice per line'
                },
                max_length: 10 * 30,
                ...(poll ? {
                    initial_value: poll.choices.join('\n')
                } : {})
            }
        },
        <InputBlock>{
            type: 'input',
            optional: true,
            block_id: 'presets',
            label: {
                type: 'plain_text',
                text: 'Preset Choices'
            },
            hint: {
                type: 'plain_text',
                text: 'Any preset choices members can also vote for (appended to the choices above).'
            },
            element: {
                type: 'multi_static_select',
                action_id: 'input',
                placeholder: {
                    type: 'plain_text',
                    text: 'Select any preset choices'
                },
                options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Yes / No / Abstain'
                        },
                        value: 'yes-no-abstain'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Accept / Reject'
                        },
                        value: 'accept-reject'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Member Names'
                        },
                        value: 'member-names'
                    }
                ]
            }
        },
        <InputBlock>{
            type: 'input',
            block_id: 'method',
            label: {
                type: 'plain_text',
                text: 'Polling Method'
            },
            element: {
                type: 'static_select',
                action_id: 'input',
                placeholder: {
                    type: 'plain_text',
                    text: 'Select a polling method'
                },
                initial_option:
                    {
                        'anonymous': {
                            text: {
                                type: 'plain_text',
                                text: 'Anonymous (vote/unvote notices, tallied results)'
                            },
                            value: 'anonymous'
                        },
                        'simultaneous': {
                            text: {
                                type: 'plain_text',
                                text: 'Simultaneous (vote/unvote notices, ascribed results)'
                            },
                            value: 'simultaneous'
                        },
                        'live': {
                            text: {
                                type: 'plain_text',
                                text: 'Live (vote-for/unvote notices, ascribed results)'
                            },
                            value: 'live'
                        }
                    }[poll ? poll.method : 'anonymous'],
                options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Anonymous (vote/unvote notices, tallied results)'
                        },
                        value: 'anonymous'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Simultaneous (vote/unvote notices, ascribed results)'
                        },
                        value: 'simultaneous'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Live (vote-for/unvote notices, ascribed results)'
                        },
                        value: 'live'
                    }
                ]
            }
        },
        <InputBlock>{
            type: 'input',
            optional: true,
            block_id: 'features',
            label: {
                type: 'plain_text',
                text: 'Features'
            },
            element: {
                type: 'checkboxes',
                action_id: 'inputs',
                // TODO option to forbid changing vote
                options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Automatic Closing',
                            emoji: true
                        },
                        description: {
                            type: 'plain_text',
                            text: 'Closes automatically when all members have voted.'
                        },
                        value: 'autoclose'
                    }
                ],
                ...(!poll || poll.autoclose
                    ? { initial_options: [
                        {
                            text: {
                                type: 'plain_text',
                                text: 'Automatic Closing',
                                emoji: true
                            },
                            description: {
                                type: 'plain_text',
                                text: 'Closes automatically when all members have voted.'
                            },
                            value: 'autoclose'
                        }
                    ] }
                    : {}
                )
            }
        }
    ]
});

type Input<T> = { input: T }
type Inputs<T> = { inputs: T }

export const register = ({ app, store, cache }: { app: App; store: Promise<MongoClient>; cache: Cache }): void => {
    const re_lines = /\r\n|\r|\n/,
        re_mrkdwn = /([*_~`<>])/g;
    app.view('create_edit_poll_modal', async ({ ack, body, view, context, client }) => {
        const host = body.user.id,
            data = view.state.values,
            audience = (<Input<ChannelsSelectAction>> data.audience).input.selected_channel,
            members = (<Input<MultiUsersSelectAction>> data.members).input.selected_users,
            prompt = (<Input<ButtonAction>> data.prompt).input.value.replace(re_lines, ' ').replace(re_mrkdwn, ''),
            choices = (<Input<ButtonAction>> data.choices).input.value ? (<Input<ButtonAction>> data.choices).input.value.trim().split(re_lines).map((choice: string) => choice.trim().replace(re_mrkdwn, '')).filter(Boolean) : [],
            presets = (<Input<MultiStaticSelectAction>> data.presets).input.selected_options.map(preset => preset.value),
            method = (<Input<StaticSelectAction>> data.method).input.selected_option.value as 'anonymous' | 'simultaneous' | 'live',
            features = ((<Inputs<CheckboxesAction>> data.features).inputs.selected_options ?? []).map(checkbox => checkbox.value as string),
            autoclose = features.includes('autoclose');

        const errors: { [blockId: string]: string } = {};

        if (members.includes(context.botUserId))
            errors.members = "You can't choose this bot as a member.";

        else if (members.length < 2)
            errors.members = 'You must choose at least 2 members.';

        if (presets.includes('yes-no-abstain'))
            choices.push('Yes', 'No', 'Abstain');

        if (presets.includes('accept-reject'))
            choices.push('Accept', 'Reject');

        if (presets.includes('member-names')) {
            const shuffled = shuffleCopy(members);

            for (const member of shuffled) {
                const profile = (await client.users.profile.get({
                    token: <string> context.botToken,
                    user: member
                }) as WebAPICallResult & {
                    profile: {
                        real_name_normalized: string;
                        display_name_normalized: string;
                    };
                }).profile;

                if (profile.display_name_normalized)
                    choices.push(trunc(profile.display_name_normalized, 30));
                else
                    choices.push(trunc(profile.real_name_normalized, 30));
            }
        }

        // TODO suffix or otherwise resolve duplicates
        if ([...new Set(choices)].length < choices.length)
            errors.choices = "You can't repeat any choices.";

        // TODO support more than 10 choices
        else if (choices.length < 2 || choices.length > 10)
            errors.choices = 'You must list from 2 to 10 choices.';

        else if (choices.some(choice => choice.length > 30))
            errors.choices = "You can't list a choice longer than 30 characters.";

        if (size(errors) > 0)
            return await ack({
                response_action: 'errors',
                errors: errors
            });

        await ack();

        if (view.private_metadata == 'new') {
            const ipoll: Poll = {
                _id: undefined,
                opened: new Date(),
                host,
                audience,
                members,
                prompt,
                choices,
                method,
                autoclose,
                votes: {}
            };

            const coll = (await store).db().collection('polls');
            ipoll._id = <ObjectId> (await coll.insertOne(ipoll)).insertedId;

            await announce({ mode: 'open', poll: ipoll, context, body, client, store });
        }
        else {
            const coll = (await store).db().collection('polls');
            const upoll = <Poll> (await coll.findOneAndUpdate(
                {
                    _id: new ObjectID(view.private_metadata),
                    host
                },
                { $set: {
                    edited: new Date(),
                    audience,
                    members,
                    prompt,
                    choices,
                    method,
                    autoclose,
                    votes: {} // TODO selectively reset or preserve
                } },
                { returnOriginal: false }
            )).value;

            await announce({ mode: 'edit', poll: upoll, context, body, client, store });

            await client.views.publish({
                token: <string> context.botToken,
                user_id: host,
                view: await home.view({ user: host, store, cache, context })
            });
        }
    });
};
