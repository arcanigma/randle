import { App } from '@slack/bolt';
import { MongoClient } from 'mongodb';

import app_home_opened from '../events/app_home_opened';

export default (app: App, store: Promise<MongoClient>): void => {
    app_home_opened(app, store);
};
