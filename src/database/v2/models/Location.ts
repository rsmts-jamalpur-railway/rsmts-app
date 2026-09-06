import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation, children } from '@nozbe/watermelondb/decorators';

export default class Location extends Model {
  static table = 'locations';

  @field('server_id') serverId?: string;
  @field('location_id') locationId!: string;
  @field('location_type') locationType!: string;
  @field('name') name?: string;
  @field('zone') zone?: string;
  @field('max_capacity') maxCapacity!: number;
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('assets') assets: any;
}
