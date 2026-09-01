import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 6,
  tables: [
    // ---------------------------------------------------------
    // REFERENCE DATA (No client_operation_id needed)
    // ---------------------------------------------------------
    tableSchema({
      name: 'users',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'username', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'assigned_location_id', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'locations',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'location_id', type: 'string', isIndexed: true },
        { name: 'location_type', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'max_capacity', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'assets',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true }, // Optional to allow offline creation
        { name: 'asset_number', type: 'string', isIndexed: true },
        { name: 'asset_category', type: 'string' },
        { name: 'asset_type', type: 'string' },
        { name: 'current_status', type: 'string' },
        { name: 'current_location_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ---------------------------------------------------------
    // OPERATIONAL DATA (Requires client_operation_id for mutations)
    // ---------------------------------------------------------
    tableSchema({
      name: 'repair_cycles',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'client_operation_id', type: 'string', isIndexed: true, isOptional: true }, // Nullable if strictly synced from server
        { name: 'asset_id', type: 'string', isIndexed: true },
        { name: 'repair_shop_id', type: 'string', isIndexed: true },
        { name: 'repair_category_id', type: 'string', isIndexed: true }, // Added missing field
        { name: 'status', type: 'string' },
        { name: 'started_at', type: 'number', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'repair_holds',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'client_operation_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'repair_cycle_id', type: 'string', isIndexed: true },
        { name: 'hold_reason', type: 'string' },
        { name: 'hold_start', type: 'number' },
        { name: 'hold_end', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'manufacturing_orders',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'client_operation_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'asset_id', type: 'string', isIndexed: true }, // Added missing relationship
        { name: 'target_asset_type', type: 'string' },
        { name: 'order_status', type: 'string' },
        { name: 'manufacturing_shop_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'qa_inspections',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'client_operation_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'asset_id', type: 'string', isIndexed: true },
        { name: 'repair_cycle_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'manufacturing_order_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'verdict', type: 'string', isOptional: true },
        { name: 'remarks', type: 'string', isOptional: true }, // Added missing field
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'fit_certificates',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'client_operation_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'inspection_id', type: 'string', isIndexed: true },
        { name: 'certificate_number', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'exceptions',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'client_operation_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'asset_id', type: 'string', isIndexed: true },
        { name: 'exception_type', type: 'string' }, // Added type
        { name: 'status', type: 'string' },
        { name: 'severity', type: 'string' },
        { name: 'assigned_to', type: 'string', isIndexed: true, isOptional: true }, // Added
        { name: 'resolved_at', type: 'number', isOptional: true }, // Added
        { name: 'resolution_remarks', type: 'string', isOptional: true }, // Added
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'movement_logs',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'client_operation_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'asset_id', type: 'string', isIndexed: true },
        { name: 'from_location_id', type: 'string', isOptional: true },
        { name: 'to_location_id', type: 'string' },
        { name: 'previous_status', type: 'string', isOptional: true },
        { name: 'new_status', type: 'string' },
        { name: 'repair_cycle_id', type: 'string', isIndexed: true, isOptional: true }, // Added context
        { name: 'manufacturing_order_id', type: 'string', isIndexed: true, isOptional: true }, // Added context
        { name: 'remarks', type: 'string', isOptional: true }, // Added remarks
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ---------------------------------------------------------
    // OUTBOX / COMMAND QUEUE (Fully decoupled from normal records)
    // ---------------------------------------------------------
    tableSchema({
      name: 'sync_operations',
      columns: [
        { name: 'client_operation_id', type: 'string', isIndexed: true },
        { name: 'command_type', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true }, // 'pending', 'processing', 'retry', 'synced', 'conflict'
        
        // Retry logic and diagnostics
        { name: 'attempt_count', type: 'number' },
        { name: 'last_attempt_at', type: 'number', isOptional: true },
        { name: 'next_retry_at', type: 'number', isOptional: true },
        { name: 'error_code', type: 'string', isOptional: true },
        { name: 'server_response', type: 'string', isOptional: true },
        
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
