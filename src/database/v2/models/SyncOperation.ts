import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class SyncOperation extends Model {
  static table = 'sync_operations';

  @field('client_operation_id') clientOperationId!: string;
  @field('command_type') commandType!: string;
  @field('payload') payload!: string;
  @field('status') status!: string; // 'pending', 'processing', 'retry', 'synced', 'conflict'
  
  @field('attempt_count') attemptCount!: number;
  @date('last_attempt_at') lastAttemptAt!: Date | null;
  @date('next_retry_at') nextRetryAt!: Date | null;
  @field('error_code') errorCode!: string | null;
  @field('server_response') serverResponse!: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
