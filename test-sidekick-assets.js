const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const assetRoot = path.join(projectRoot, 'assets', 'sidekicks');
const manifest = JSON.parse(
  fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8')
);

const expectedSizes = [512, 256, 128];
const expectedIds = manifest.sidekicks.map(sidekick => sidekick.id);

assert.equal(manifest.version, 1);
assert.equal(manifest.license, 'CC-BY-4.0');
assert.equal(expectedIds.length, 16, 'The launch set must contain 16 Sidekicks');
assert.equal(new Set(expectedIds).size, 16, 'Every Sidekick ID must be unique');

function readPngDimensions(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  assert.equal(header.toString('hex', 0, 8), '89504e470d0a1a0a', `${filePath} must be a PNG`);
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20)
  };
}

function assertWebp(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 12);
  assert.equal(header.toString('ascii', 0, 4), 'RIFF', `${filePath} must have a RIFF header`);
  assert.equal(header.toString('ascii', 8, 12), 'WEBP', `${filePath} must be a WebP`);
}

let webpPayloadBytes = 0;

for (const id of expectedIds) {
  for (const size of expectedSizes) {
    const pngPath = size === 512
      ? path.join(assetRoot, 'png', `${id}.png`)
      : path.join(assetRoot, 'png', String(size), `${id}.png`);
    const webpPath = path.join(assetRoot, 'webp', String(size), `${id}.webp`);

    assert.ok(fs.existsSync(pngPath), `Missing ${size}px PNG for ${id}`);
    assert.ok(fs.existsSync(webpPath), `Missing ${size}px WebP for ${id}`);
    assert.deepStrictEqual(
      readPngDimensions(pngPath),
      { width: size, height: size },
      `${id} PNG must be ${size}x${size}`
    );
    assertWebp(webpPath);
    webpPayloadBytes += fs.statSync(webpPath).size;
  }
}

assert.ok(
  webpPayloadBytes < 1_500_000,
  `Sidekick WebP payload must remain below 1.5 MB; found ${webpPayloadBytes} bytes`
);

console.log(`Sidekick asset contract passed (${webpPayloadBytes} WebP bytes)`);
