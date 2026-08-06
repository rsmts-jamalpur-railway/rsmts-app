import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class MovementLog extends Model {
  static table = 'movement_logs';

  @field('asset_number') asset_number!: string;
  @field('from_location') from_location?: string;
  @field('to_location') to_location!: string;
  @field('previous_status') previous_status?: string;
  @field('new_status') new_status!: string;
  @field('handled_by') handled_by!: string;
  @field('remarks') remarks?: string;
  @field('repair_cycle_id') repair_cycle_id?: string;
  @field('is_offline_entry') is_offline_entry!: boolean;

  @date('timestamp') timestamp!: Date;
}
