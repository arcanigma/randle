import { Channel, Colors, Events, TextChannel } from 'discord.js';
import * as inflection from 'inflection';
import { MAX_EMBED_DESCRIPTION, MAX_EMBED_FIELDS, MAX_EMBED_TITLE, MAX_FIELD_NAME, MAX_FIELD_VALUE } from '../library/constants.js';
import { trunc } from '../library/texts.js';

export const name = Events.ChannelUpdate;
export const once = false;

const re_bracketing = /^\s*(?:\[\s*([^\]]+?)\s*\]\s*)?(.+?)\s*$/;
export async function execute (oldChannel: Channel, newChannel: Channel): Promise<void> {
    if (oldChannel instanceof TextChannel && newChannel instanceof TextChannel) {
        if (newChannel.topic && newChannel.topic != oldChannel.topic) {
            if (newChannel.topic.includes('|')) {
                const [ first, ...rest ] = newChannel.topic.split('|').map(it => it.trim()).filter(Boolean).slice(0, MAX_EMBED_FIELDS+1);

                const [ , title, description ] = first.match(re_bracketing) as string[];

                await newChannel.send({
                    content: '_New channel topic:_',
                    embeds: [
                        {
                            title: title ? trunc(title, MAX_EMBED_TITLE) : 'Topic',
                            description: trunc(description, MAX_EMBED_DESCRIPTION),
                            color: Colors.Blurple,
                            fields: rest.map((it, index) => {
                                const [ , name, value ] = it.match(re_bracketing) as string[];

                                return {
                                    name: name ? trunc(name, MAX_FIELD_NAME) : inflection.ordinalize(`${index+1} Subtopic`),
                                    value: trunc(value, MAX_FIELD_VALUE),
                                    inline: true
                                };
                            })
                        }
                    ]
                });
            }
            else {
                await newChannel.send({
                    content: `_New channel topic:_ ${trunc(newChannel.topic, MAX_EMBED_DESCRIPTION)}`
                });
            }
        }
    }
}
