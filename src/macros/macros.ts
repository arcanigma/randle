import { App } from '@slack/bolt';
import { MongoClient } from 'mongodb';
import * as edit_macro_button from './edit_macro_button';
import * as edit_macro_modal from './edit_macro_modal';

export const events = (app: App, store: Promise<MongoClient>): void => {
    edit_macro_button.events(app, store);
    edit_macro_modal.events(app, store);
};
