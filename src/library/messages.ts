import { Context, MessageEvent } from '@slack/bolt';
import { ContextBlock, SectionBlock, WebClient } from '@slack/web-api';
import { MAX_TEXT_SIZE } from '../app';
import { trunc } from './factory';

export async function blame(
  error: string | Error,
  message: MessageEvent,
  context: Context,
  client: WebClient
): Promise<void> {
  console.log({ error });
  if (error instanceof Error) {
      await client.chat.postEphemeral({
          token: context.botToken,
          user: message.user,
          channel: message.channel,
          text: 'There was an error',
          blocks: [
              <SectionBlock>{
                  type: 'section',
                  text: {
                      type: 'plain_text',
                      text: 'Your message caused an error. Please report these details to the developer.'
                  }
              },
              <ContextBlock>{
                  type: 'context',
                  elements: [
                      {
                        type: 'mrkdwn',
                        text: `:octagonal_sign: *${error.name}:* ${trunc(error.message, MAX_TEXT_SIZE)}`
                      },
                      {
                        type: 'mrkdwn',
                        text: `*Location:* ${error.stack?.match(/\w+.ts:\d+:\d+/g)?.[0] ?? 'unknown'}`
                      },
                      {
                        type: 'mrkdwn',
                        text: `*Context:* ${message.channel_type}-${message.channel}`
                      },
                      {
                        type: 'mrkdwn',
                        text: `*Text:* ${trunc(message.text ?? 'undefined', MAX_TEXT_SIZE)}`
                      }
                  ]
              }
          ]
      });
  }
  else {
      await client.chat.postEphemeral({
          token: context.botToken,
          user: message.user,
          channel: message.channel,
          text: 'There was an error',
          blocks: [
              <SectionBlock>{
                  type: 'section',
                  text: {
                      type: 'plain_text',
                      text: 'Your command has a problem. Please correct the problem before trying again.'
                  }
              },
              <ContextBlock>{
                  type: 'context',
                  elements: [
                      {
                        type: 'mrkdwn',
                        text: `:warning: *User Error:* ${trunc(error, MAX_TEXT_SIZE)}`
                      }
                  ]
              }
          ]
      });
  }
}
