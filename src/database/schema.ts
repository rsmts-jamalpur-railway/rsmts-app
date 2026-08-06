import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'assets',
      columns: [
        { name: 'asset_number', type: 'string', isIndexed: true },
        { name: 'asset_type', type: 'string' },
        { name: 'current_status', type: 'string' },
        { name: 'current_location', type: 'string', isOptional: true },
        { name: 'origin', type: 'string', isOptional: true },
        { name: 'allocated_shop', type: 'string', isOptional: true },
        { name: 'repair_category', type: 'string', isOptional: true },
        { name: 'wagon_sr', type: 'string', isOptional: true },
        { name: 'built_year', type: 'number', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'nsy_in_date', type: 'number', isOptional: true },
        { name: 'shop_in_date', type: 'number', isOptional: true },
        { name: 'fit_date', type: 'number', isOptional: true },
        { name: 'nsy_out_date', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'movement_logs',
      columns: [
        { name: 'asset_number', type: 'string', isIndexed: true },
        { name: 'from_location', type: 'string', isOptional: true },
        { name: 'to_location', type: 'string' },
        { name: 'previous_status', type: 'string', isOptional: true },
        { name: 'new_status', type: 'string' },
        { name: 'handled_by', type: 'string' },
        { name: 'remarks', type: 'string', isOptional: true },
        { name: 'repair_cycle_id', type: 'string', isOptional: true },
        { name: 'is_offline_entry', type: 'boolean' },
        { name: 'timestamp', type: 'number' },
      ],
    }),
  ],
});
