import * as schema from './src/main/db/schema'
for (const [tableName, tableObj] of Object.entries(schema)) {
  console.log(tableName)
}
