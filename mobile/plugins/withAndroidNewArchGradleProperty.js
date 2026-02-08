const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function setOrAppendGradleProperty(contents, key, value) {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (regex.test(contents)) {
    return contents.replace(regex, line);
  }

  const trimmed = contents.trimEnd();
  const suffix = trimmed.length === 0 ? '' : '\n';
  return `${trimmed}${suffix}${line}\n`;
}

module.exports = function withAndroidNewArchGradleProperty(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const gradlePropertiesPath = path.join(cfg.modRequest.platformProjectRoot, 'gradle.properties');
      let contents = '';

      try {
        contents = fs.readFileSync(gradlePropertiesPath, 'utf8');
      } catch {
        contents = '';
      }

      contents = setOrAppendGradleProperty(contents, 'newArchEnabled', 'true');

      fs.mkdirSync(path.dirname(gradlePropertiesPath), { recursive: true });
      fs.writeFileSync(gradlePropertiesPath, contents, 'utf8');

      return cfg;
    },
  ]);
};
