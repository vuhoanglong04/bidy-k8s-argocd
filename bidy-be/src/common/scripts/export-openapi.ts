import fs from 'fs';
import path from 'path';
import { swaggerSpec } from '../../config/swagger.config';

function run() {
  const outPath = path.resolve(process.cwd(), 'openapi.json');
  fs.writeFileSync(outPath, JSON.stringify(swaggerSpec, null, 2));
  console.log(`✅ OpenAPI spec exported to ${outPath}`);
}

run();
