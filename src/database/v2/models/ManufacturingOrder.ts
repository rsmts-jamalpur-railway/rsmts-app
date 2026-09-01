import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation, children } from '@nozbe/watermelondb/decorators';

export default class ManufacturingOrder extends Model {
  static table = 'manufacturing_orders';

  @field('server_id') serverId!: string | null;
  @field('client_operation_id') clientOperationId!: string | null;
  @field('asset_id') assetId!: string;
  @field('target_asset_type') targetAssetType!: string;
  @field('order_status') orderStatus!: string;
  @field('manufacturing_shop_id') manufacturingShopId!: string;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('assets', 'asset_id') asset: any;
  @relation('locations', 'manufacturing_shop_id') manufacturingShop: any;
}
