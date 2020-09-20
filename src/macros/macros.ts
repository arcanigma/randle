import { App, Context } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import { Cache } from '../app';
import * as macro_interactions from './macro_interactions';

export async function getMacro ({ user, name, store, context }: { user: string; name: string; store: Promise<MongoClient>; context: Context }): Promise<string> {
    name = name.toLowerCase();

    const coll = (await store).db().collection('macros');
    return (await coll.findOne(
        { _id: user },
        { projection: { _id: 0 } }
    ) as { [name: string]: string } ?? {})[name] ??
    (await coll.findOne(
        { _id: <string> context.botUserId },
        { projection: { _id: 0 } }
    ) as { [name: string]: string } ?? {})[name] ??
    name;
}

export const register = ({ app, store, cache }: { app: App; store: Promise<MongoClient>; cache: Cache }): void => {
    [macro_interactions].forEach(it => {
        it.register({ app, store, cache });
    });
};
