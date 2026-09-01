import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class RepairHold extends Model {
  static table = 'repair_holds';

  @field('server_id') serverId!: string | null;
  @field('client_operation_id') clientOperationId!: string | null;
  @field('repair_cycle_id') repairCycleId!: string;
  @field('hold_reason') holdReason!: string;
  
  @date('hold_start') holdStart!: Date;
  @date('hold_end') holdEnd!: Date | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('repair_cycles', 'repair_cycle_id') repairCycle: any;
}
