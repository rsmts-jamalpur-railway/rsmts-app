import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class QAInspection extends Model {
  static table = 'qa_inspections';

  @field('server_id') serverId!: string | null;
  @field('client_operation_id') clientOperationId!: string | null;
  @field('asset_id') assetId!: string;
  @field('repair_cycle_id') repairCycleId!: string | null;
  @field('manufacturing_order_id') manufacturingOrderId!: string | null;
  
  @field('status') status!: string;
  @field('verdict') verdict!: string | null;
  @field('remarks') remarks!: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('assets', 'asset_id') asset: any;
  @relation('repair_cycles', 'repair_cycle_id') repairCycle: any;
  @relation('manufacturing_orders', 'manufacturing_order_id') manufacturingOrder: any;
}
