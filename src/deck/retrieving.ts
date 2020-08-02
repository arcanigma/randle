import { Context } from '@slack/bolt';
import { WebAPICallResult, WebClient } from '@slack/web-api';
import { MongoClient } from 'mongodb';
import { shuffle } from './solving';

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

export async function getMembers(channel: string, context: Context, client: WebClient): Promise<string[]> {
  return shuffle((await client.conversations.members({
      token: context.botToken,
      channel: channel
  }) as WebAPICallResult & {
      members: string[]
  }).members.filter(user =>
      user != context.botUserId
  ));
}
