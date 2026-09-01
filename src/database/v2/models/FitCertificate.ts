import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class FitCertificate extends Model {
  static table = 'fit_certificates';

  @field('server_id') serverId!: string | null;
  @field('client_operation_id') clientOperationId!: string | null;
  
  @field('inspection_id') inspectionId!: string;
  @field('certificate_number') certificateNumber!: string;

  @readonly @date('created_at') createdAt!: Date;
}
