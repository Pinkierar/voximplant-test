const { exec } = require('node:child_process');

exec('cross-env VOX_CI_ROOT_PATH=voxengine-ci npx voxengine-ci upload');

VoxEngine.addEventListener();
