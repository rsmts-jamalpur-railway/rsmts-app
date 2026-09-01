import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users';

  @field('server_id') serverId!: string;
  @field('username') username!: string;
  @field('role') role!: string;
  @field('assigned_location_id') assignedLocationId!: string | null;
  @field('is_active') isActive!: boolean;
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
