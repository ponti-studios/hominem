import 'dotenv/config';

import { importWarehouseSnapshot } from '../src/workers/warehouse-import';

const databasePath = process.env.WAREHOUSE_DATABASE_PATH;
const ownerUserId = process.env.WAREHOUSE_IMPORT_OWNER_USER_ID;

if (!databasePath || !ownerUserId) {
  console.error(
    'WAREHOUSE_DATABASE_PATH and WAREHOUSE_IMPORT_OWNER_USER_ID are required for a Warehouse import.',
  );
  process.exit(1);
}

const result = await importWarehouseSnapshot({
  ownerUserId,
  databasePath,
  sourceDisplayName: process.env.WAREHOUSE_IMPORT_SOURCE_NAME,
});

console.log(JSON.stringify(result, null, 2));
