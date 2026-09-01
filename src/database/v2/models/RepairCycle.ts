import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation, children } from '@nozbe/watermelondb/decorators';

export default class RepairCycle extends Model {
  static table = 'repair_cycles';

  @field('server_id') serverId!: string | null;
  @field('client_operation_id') clientOperationId!: string | null;
  @field('asset_id') assetId!: string;
  @field('repair_shop_id') repairShopId!: string;
  @field('repair_category_id') repairCategoryId!: string;
  @field('status') status!: string;
  
  @date('started_at') startedAt!: Date | null;
  @date('completed_at') completedAt!: Date | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('assets', 'asset_id') asset: any;
  @relation('locations', 'repair_shop_id') repairShop: any;
  
  @children('repair_holds') repairHolds: any;
}
