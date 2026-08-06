import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Asset extends Model {
  static table = 'assets';

  @field('asset_number') asset_number!: string;
  @field('asset_type') asset_type!: string;
  @field('current_status') current_status!: string;
  @field('current_location') current_location?: string;
  @field('origin') origin?: string;
  @field('allocated_shop') allocated_shop?: string;
  @field('repair_category') repair_category?: string;
  @field('wagon_sr') wagon_sr?: string;
  @field('built_year') built_year?: number;
  @field('is_active') is_active!: boolean;
  
  @date('nsy_in_date') nsy_in_date?: Date;
  @date('shop_in_date') shop_in_date?: Date;
  @date('fit_date') fit_date?: Date;
  @date('nsy_out_date') nsy_out_date?: Date;
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
