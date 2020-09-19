import { Context, MessageEvent } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { ElementDefinition } from 'cytoscape';
import puppeteer from 'puppeteer';
import { Script } from './deck';

export async function uploadGraphFile ({ title, elements, script, message, context, client }:
    { title: string; elements: ElementDefinition[]; script: Script; message: MessageEvent; context: Context; client: WebClient }
): Promise<void> {
    if (elements.length == 0)
        throw 'Unexected 0 graph elements.';

    const html = graphToHtml(title, elements);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    await page.setViewport({
        width: 1440,
        height: 1440,
        deviceScaleFactor: 1
    });

    await page.setContent(html);

    const shot = await page.screenshot({
        type: 'png'
    });

    await browser.close();

    await client.files.upload({
        token: <string> context.botToken,
        channels: message.channel,
        title: title,
        filename: 'graph.png',
        file: shot,
        initial_comment: `There is a rules graph available for ${script.event ? `the *${script.event}*` : 'this'} event.`,
    });
}

function graphToHtml (title: string, graph: ElementDefinition[]): string {
    return `<html>
    <head>
        <title>${title}</title>

        <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1">

        <script src="https://unpkg.com/cytoscape/dist/cytoscape.min.js"></script>
        <script src="https://unpkg.com/layout-base/layout-base.js"></script>
        <script src="https://unpkg.com/avsdf-base/avsdf-base.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/cytoscape-avsdf@1.0.0/cytoscape-avsdf.min.js"></script>

        <style>
            #cy {
                width: 100%;
                height: 100%;
                margin: auto;
                display: block;
            }
        </style>

        <script>
            document.addEventListener('DOMContentLoaded', function(){
                var cy = window.cy = cytoscape({
                    container: document.getElementById('cy'),

                    layout: {
                        name: 'avsdf',
                        nodeSeparation: 120,
                        animate: false
                    },

                    elements: ${JSON.stringify(graph)},

                    style: [
                        {
                            selector: 'node',
                            style: {
                                'label': 'data(id)',
                                'text-valign': 'center',
                                'color': 'white',
                                'text-outline-width': 3,
                                'text-outline-color': 'data(color)',
                                'background-color': 'data(color)'
                            }
                        },
                        {
                            selector: 'edge',
                            style: {
                                'curve-style': 'bezier',
                                'width': 3,
                                'line-color': function(edge) {
                                    return edge.source().data('color');
                                },
                                'arrow-scale': 1.5,
                                'target-arrow-fill': 'hollow',
                                'target-arrow-color': function(edge) {
                                    return edge.source().data('color');
                                },
                                'target-arrow-shape': 'data(arrow)',
                            }
                        }
                    ]
                });
            });
        </script>
    </head>

    <body>
        <div id="cy"></div>
    </body>
</html>`;
}
