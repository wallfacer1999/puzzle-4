import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outputDir = join(root, 'dist/build/mp-weixin');
const appJsonPath = join(outputDir, 'app.json');
const projectConfigPath = join(outputDir, 'project.config.json');
const rootProjectConfigPath = join(root, 'project.config.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

if (!existsSync(appJsonPath)) {
  throw new Error(`Missing ${appJsonPath}. Run uni build -p mp-weixin first.`);
}

const appJson = readJson(appJsonPath);
appJson.pages ??= ['pages/game/index'];
appJson.subPackages ??= [];
appJson.window ??= {};
appJson.usingComponents ??= {};
writeJson(appJsonPath, appJson);

const rootProjectConfig = existsSync(rootProjectConfigPath) ? readJson(rootProjectConfigPath) : {};
const projectConfig = existsSync(projectConfigPath) ? readJson(projectConfigPath) : {};
projectConfig.appid = rootProjectConfig.appid ?? projectConfig.appid;
projectConfig.projectname = rootProjectConfig.projectname ?? projectConfig.projectname ?? 'T字之谜';
projectConfig.compileType = 'miniprogram';
projectConfig.setting = {
  ...(projectConfig.setting ?? {}),
  ...(rootProjectConfig.setting ?? {}),
};
projectConfig.condition ??= rootProjectConfig.condition ?? {
  search: { current: -1, list: [] },
  conversation: { current: -1, list: [] },
  game: { current: -1, list: [] },
  miniprogram: { current: -1, list: [] },
};
writeJson(projectConfigPath, projectConfig);

console.log('Fixed mp-weixin app.json and project.config.json');
