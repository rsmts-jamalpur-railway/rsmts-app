import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation, children } from '@nozbe/watermelondb/decorators';

export default class Asset extends Model {
  static table = 'assets';

  @field('server_id') serverId!: string | null;
  @field('asset_number') assetNumber!: string;
  @field('asset_category') assetCategory!: string;
  @field('asset_type') assetType!: string;
  @field('current_status') currentStatus!: string;
  @field('current_location_id') currentLocationId!: string;
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('locations', 'current_location_id') location: any;
  
  @children('repair_cycles') repairCycles: any;
  @children('manufacturing_orders') manufacturingOrders: any;
  @children('qa_inspections') qaInspections: any;
  @children('exceptions') exceptions: any;
  @children('movement_logs') movementLogs: any;
}
