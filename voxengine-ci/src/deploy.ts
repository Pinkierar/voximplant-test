import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

const dirItems = fs.readdirSync('source_files/applications', { encoding: 'utf-8', withFileTypes: true });

for (const dirItem of dirItems) {
  const [applicationName] = dirItem.name.split('.');
  const cmd = `cross-env VOX_CI_ROOT_PATH=source_files npx voxengine-ci upload --application-name ${applicationName}`;
  console.log(cmd);
  execSync(cmd);
}
