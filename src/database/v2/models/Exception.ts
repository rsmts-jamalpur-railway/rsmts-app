import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class Exception extends Model {
  static table = 'exceptions';

  @field('server_id') serverId!: string | null;
  @field('client_operation_id') clientOperationId!: string | null;
  @field('asset_id') assetId!: string;
  
  @field('exception_type') exceptionType!: string;
  @field('status') status!: string;
  @field('severity') severity!: string;
  
  @field('assigned_to') assignedTo!: string | null;
  @date('resolved_at') resolvedAt!: Date | null;
  @field('resolution_remarks') resolutionRemarks!: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('assets', 'asset_id') asset: any;
  @relation('users', 'assigned_to') assignee: any;
}
