import { App, ButtonAction, ChannelsSelectAction, CheckboxesAction, Context, MultiUsersSelectAction, StaticSelectAction } from '@slack/bolt';
import { InputBlock, View, WebAPICallResult, WebClient } from '@slack/web-api';
import { MongoClient, ObjectId } from 'mongodb';
import { shuffleInPlace } from '../deck/solving';
import { size } from '../library/factory';
import { announce, Poll, PollSetupOptions } from './polls';

export const view = async ({ channel, context, client }: { channel: string | undefined; context: Context; client: WebClient }): Promise<View> => ({
    type: 'modal',
    callback_id: 'create_poll_modal',
    title: {
        type: 'plain_text',
        text: 'Create a poll'
    },
    submit: {
        type: 'plain_text',
        text: 'Create'
    },
    close: {
        type: 'plain_text',
        text: 'Cancel'
    },
    blocks: [
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
                ...channel ? {
                    initial_channel: channel
                } : {}
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
                initial_users: channel ? ((await client.conversations.members({
                    token: <string> context.botToken,
                    channel: channel
                }) as WebAPICallResult & {
                    members: string[];
                }).members.filter(user => user != context.botUserId)) : []
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
                max_length: 300
            }
        },
        <InputBlock>{
            type: 'input',
            block_id: 'choices',
            label: {
                type: 'plain_text',
                text: 'Choices'
            },
            hint: {
                type: 'plain_text',
                text: 'The choices members vote for (one per line, no formatting, emoji okay).'
            },
            element: {
                type: 'plain_text_input',
                action_id: 'input',
                multiline: true,
                placeholder: {
                    type: 'plain_text',
                    text: 'One choice per line'
                },
                min_length: 5,
                max_length: 300
            }
        },
        <InputBlock>{
            type: 'input',
            block_id: 'order',
            label: {
                type: 'plain_text',
                text: 'Order of Choices'
            },
            element: {
                type: 'static_select',
                action_id: 'input',
                placeholder: {
                    type: 'plain_text',
                    text: 'Select an order'
                },
                initial_option: {
                    text: {
                        type: 'plain_text',
                        text: 'Original'
                    },
                    value: 'original'
                },
                options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Original'
                        },
                        value: 'original'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Sort Ascending'
                        },
                        value: 'ascending'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Sort Descending'
                        },
                        value: 'descending'
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: 'Shuffle'
                        },
                        value: 'shuffle'
                    }
                ]
            }
        },
        <InputBlock>{
            type: 'input',
            optional: true,
            block_id: 'setup',
            label: {
                type: 'plain_text',
                text: 'Setup'
            },
            element: {
                type: 'checkboxes',
                action_id: 'inputs',
                options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: ':busts_in_silhouette: Anonymous Voting',
                            emoji: true
                        },
                        description: {
                            type: 'plain_text',
                            text: 'Results show only tallies, not member names.'
                        },
                        value: PollSetupOptions.Anonymous
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: ':bell: Participation Notices',
                            emoji: true
                        },
                        description: {
                            type: 'plain_text',
                            text: 'Announce each time a member votes or unvotes.'
                        },
                        value: PollSetupOptions.Participation
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: ':hourglass_flowing_sand: Automatic Closing',
                            emoji: true
                        },
                        description: {
                            type: 'plain_text',
                            text: 'Closes automatically when all members have voted.'
                        },
                        value: PollSetupOptions.Autoclose
                    }
                ],
                initial_options: [
                    {
                        text: {
                            type: 'plain_text',
                            text: ':bell: Participation Notices',
                            emoji: true
                        },
                        description: {
                            type: 'plain_text',
                            text: 'Announce each time a member votes or unvotes.'
                        },
                        value: PollSetupOptions.Participation
                    },
                    {
                        text: {
                            type: 'plain_text',
                            text: ':hourglass_flowing_sand: Automatic Closing',
                            emoji: true
                        },
                        description: {
                            type: 'plain_text',
                            text: 'Closes automatically when all members have voted.'
                        },
                        value: PollSetupOptions.Autoclose
                    }
                ]
            }
        }
    ]
});

type Input<T> = { input: T }
type Inputs<T> = { inputs: T }

export const register = ({ app, store }: { app: App; store: Promise<MongoClient> }): void => {
    const re_lines = /\r\n|\r|\n/,
        re_mrkdwn = /([*_~`<>])/g;
    app.view('create_poll_modal', async ({ ack, body, view, context, client }) => {
        const host = body.user.id,
            data = view.state.values,
            audience = (<Input<ChannelsSelectAction>> data.audience).input.selected_channel,
            members = (<Input<MultiUsersSelectAction>> data.members).input.selected_users,
            prompt = (<Input<ButtonAction>> data.prompt).input.value.replace(re_lines, ' ').replace(re_mrkdwn, ''),
            choices = (<Input<ButtonAction>> data.choices).input.value.trim().split(re_lines).map((choice: string) => choice.trim().replace(re_mrkdwn, '')).filter(Boolean),
            order = (<Input<StaticSelectAction>> data.order).input.selected_option.value,
            setup = ((<Inputs<CheckboxesAction>> data.setup).inputs.selected_options ?? []).map(checkbox => <PollSetupOptions> checkbox.value);

        const errors: { [blockId: string]: string } = {};

        if (members.includes(context.botUserId))
            errors.members = "You can't choose this bot as a member.";
        else if (members.length < 2)
            errors.members = 'You must choose at least 2 members.';

        if ([...new Set(choices)].length < choices.length)
            errors.choices = "You can't repeat any choices.";
        else if (choices.length < 1 || choices.length > 10)
            errors.choices = 'You must list from 1 to 10 choices.';

        if (choices.some(choice => choice.length > 30))
            errors.choices = "You can't list a choice longer than 30 characters.";

        if (size(errors) > 0)
            return await ack({
                response_action: 'errors',
                errors: errors
            });

        await ack();

        if (order == 'ascending')
            choices.sort();
        else if (order == 'descending')
            choices.sort().reverse();
        else if (order == 'shuffle')
            shuffleInPlace(choices);

        const poll: Poll = {
            _id: undefined,
            opened: new Date(),
            host,
            audience,
            members,
            prompt,
            choices,
            setup,
            votes: {}
        };

        const coll = (await store).db().collection('polls');
        poll._id = <ObjectId> (await coll.insertOne(poll)).insertedId;

        await announce({ mode: 'open', poll, context, body, client, store });
    });
};
