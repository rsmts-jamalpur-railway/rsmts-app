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
  
  @field('railway_zone') railwayZone!: string | null;
  @field('track_line') trackLine!: string | null;
  @field('train_number') trainNumber!: string | null;
  @field('condition') condition!: string | null;
  @field('remarks') remarks!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('locations', 'current_location_id') location: any;
  
  @children('repair_cycles') repairCycles: any;
  @children('manufacturing_orders') manufacturingOrders: any;
  @children('qa_inspections') qaInspections: any;
  @children('exceptions') exceptions: any;
  @children('movement_logs') movementLogs: any;

  // Backward-compatible snake_case getters
  get asset_number(): string {
    return this.assetNumber;
  }
  get current_status(): string {
    return this.currentStatus;
  }
  get current_location(): string {
    return this.currentLocationId;
  }
  get currentLocation(): string {
    return this.currentLocationId;
  }
  get allocated_shop(): string {
    return this.currentLocationId;
  }
}
