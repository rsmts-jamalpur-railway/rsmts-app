import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class MovementLog extends Model {
  static table = 'movement_logs';

  @field('server_id') serverId!: string | null;
  @field('client_operation_id') clientOperationId!: string | null;
  @field('asset_id') assetId!: string;
  
  @field('from_location_id') fromLocationId!: string | null;
  @field('to_location_id') toLocationId!: string;
  
  @field('previous_status') previousStatus!: string | null;
  @field('new_status') newStatus!: string;
  
  @field('repair_cycle_id') repairCycleId!: string | null;
  @field('manufacturing_order_id') manufacturingOrderId!: string | null;
  
  @field('remarks') remarks!: string | null;

  @readonly @date('created_at') createdAt!: Date;

  @relation('assets', 'asset_id') asset: any;
  @relation('locations', 'from_location_id') fromLocation: any;
  @relation('locations', 'to_location_id') toLocation: any;
}
