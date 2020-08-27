import { App, Context } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import * as edit_macro_button from './edit_macro_button';
import * as edit_macro_modal from './edit_macro_modal';

export async function getMacro(store: Promise<MongoClient>, context: Context, user: string, name: string): Promise<string> {
    const coll = (await store).db().collection('macros');
    return (await coll.findOne(
        { _id: user },
        { projection: { _id: 0} }
    ) || {})[name]
    ?? (await coll.findOne(
        { _id: context.botUserId },
        { projection: { _id: 0} }
    ) || {})[name]
    ?? name;
}

export const events = (app: App, store: Promise<MongoClient>): void => {
    edit_macro_button.events(app, store);
    edit_macro_modal.events(app, store);
};
