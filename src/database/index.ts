import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Asset from './models/Asset';
import MovementLog from './models/MovementLog';
import Location from './models/Location';
import Setting from './models/Setting';

const adapter = new SQLiteAdapter({
  schema,
  // jsi: true, // Requires complex native setup in MainApplication.kt
  onSetUpError: error => {
    console.error("Database setup failed", error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Asset,
    MovementLog,
    Location,
    Setting,
  ],
});
