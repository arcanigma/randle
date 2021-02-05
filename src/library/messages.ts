import { BotMessageEvent, Context, GenericMessageEvent, MessageEvent } from '@slack/bolt';
import { ContextBlock, SectionBlock, WebClient } from '@slack/web-api';
import { MAX_TEXT_SIZE } from '../app';
import { trunc } from './factory';

export async function blame ({ error, message, context, client }:
    { error: string | Error; message: MessageEvent; context: Context; client: WebClient }
): Promise<void> {
    if (error instanceof Error) {
        console.error({ error });
        await client.chat.postEphemeral({
            token: <string> context.botToken,
            user: (<GenericMessageEvent> message).user,
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
                          text: `*Context:* ${message.channel} (${(<BotMessageEvent> message).channel_type})`
                      },
                      {
                          type: 'mrkdwn',
                          text: `*Text:* ${trunc((<GenericMessageEvent> message).text ?? 'undefined', MAX_TEXT_SIZE)}`
                      }
                  ]
              }
            ]
        });
    }
    else {
        console.warn({ error });
        await client.chat.postEphemeral({
            token: <string> context.botToken,
            user: (<GenericMessageEvent> message).user,
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
