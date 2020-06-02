import { App } from '@slack/bolt';
import { MongoClient } from 'mongodb';

import edit_macro_button from '../events/edit_macro_button';
import edit_macro_modal from '../events/edit_macro_modal';

export default (app: App, store: Promise<MongoClient>): void => {
    edit_macro_button(app, store);
    edit_macro_modal(app, store);
};
