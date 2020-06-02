import { View, Block } from '@slack/web-api';
import { MongoClient } from 'mongodb';

import { MAX_VIEW_BLOCKS } from '../app.js';

import list_macros_blocks from '../views/list_macros_blocks';
import list_polls_blocks from '../views/list_polls_blocks';

/*
    TODO 100 block error

    selection menu:
        open polls
        closed polls
        all polls
        macros
    remember selection
*/

export default async (user: string, store: Promise<MongoClient>, options?: HomeOptions): Promise<View> => ({
    type: 'home',
    blocks: [
        ...await list_polls_blocks(user, store, options ?? { polls: { filter: PollFilterOptions.Open }}),
        { type: 'divider' },
        ...await list_macros_blocks(user, store),
        { type: 'divider' }
    ].slice(0, MAX_VIEW_BLOCKS) as Block[]
});

export type HomeOptions = {
    polls: {
        filter: PollFilterOptions;
    };
};

export enum PollFilterOptions {
    Open = 'open',
    Closed = 'closed',
    All = 'all'
}
