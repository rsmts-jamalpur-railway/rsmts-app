import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Location extends Model {
  static table = 'locations';

  @field('location_id') location_id!: string;
  @field('max_capacity') max_capacity!: number;
  @field('standard_tat_hours') standard_tat_hours!: number;
  @field('zone') zone!: string | null;
  @field('is_parking_line') is_parking_line!: boolean;
}
