import { inflateRawSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceUrl = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip';
const sourceEntryName = '2025_Gaz_place_national.txt';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const statesSourcePath = path.join(projectRoot, 'lib', 'brand.ts');
const outputDirectory = path.join(projectRoot, 'public', 'data', 'us-cities');

function readStates(source) {
  const match = source.match(/export const STATES = \[([\s\S]*?)\] as const;/);
  if (!match) throw new Error('Could not find the STATES array in lib/brand.ts.');
  const states = [...match[1].matchAll(/\['([A-Z]{2})',\s*'([^']+)'\]/g)]
    .map(([, code, name]) => ({ code, name }));
  if (states.length !== 50 || new Set(states.map(({ code }) => code)).size !== 50) {
    throw new Error(`Expected 50 unique state codes in lib/brand.ts; found ${states.length}.`);
  }
  return states;
}

function findGazetteerEntry(zip) {
  let endOffset = -1;
  const minimumOffset = Math.max(0, zip.length - 22 - 0xffff);
  for (let offset = zip.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error('The Census download is not a valid ZIP archive.');

  const entryCount = zip.readUInt16LE(endOffset + 10);
  let centralOffset = zip.readUInt32LE(endOffset + 16);
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (zip.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error('The Census ZIP central directory is invalid.');
    }
    const compressionMethod = zip.readUInt16LE(centralOffset + 10);
    const expectedCrc = zip.readUInt32LE(centralOffset + 16);
    const compressedSize = zip.readUInt32LE(centralOffset + 20);
    const uncompressedSize = zip.readUInt32LE(centralOffset + 24);
    const fileNameLength = zip.readUInt16LE(centralOffset + 28);
    const extraLength = zip.readUInt16LE(centralOffset + 30);
    const commentLength = zip.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = zip.readUInt32LE(centralOffset + 42);
    const fileName = zip.toString('utf8', centralOffset + 46, centralOffset + 46 + fileNameLength);

    if (fileName === sourceEntryName) {
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error('The Census ZIP local file header is invalid.');
      }
      const localFileNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = zip.subarray(dataOffset, dataOffset + compressedSize);
      let contents;
      if (compressionMethod === 0) contents = compressedData;
      else if (compressionMethod === 8) contents = inflateRawSync(compressedData);
      else throw new Error(`Unsupported ZIP compression method: ${compressionMethod}.`);
      if (contents.length !== uncompressedSize || crc32(contents) !== expectedCrc) {
        throw new Error('The Census Gazetteer ZIP entry failed its integrity check.');
      }
      return contents.toString('utf8');
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`The ZIP archive does not contain ${sourceEntryName}.`);
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let remainder = value;
  for (let bit = 0; bit < 8; bit += 1) {
    remainder = remainder & 1 ? 0xedb88320 ^ (remainder >>> 1) : remainder >>> 1;
  }
  return remainder >>> 0;
});

function crc32(buffer) {
  let checksum = 0xffffffff;
  for (const byte of buffer) checksum = crcTable[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

async function downloadGazetteer() {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Census download failed with HTTP ${response.status}.`);
  const zip = Buffer.from(await response.arrayBuffer());
  if (zip.length < 4 || zip.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Census download did not return a ZIP archive.');
  }
  return findGazetteerEntry(zip);
}

function parsePlaces(contents, states) {
  const stateCodes = new Set(states.map(({ code }) => code));
  const [headerLine, ...recordLines] = contents.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!headerLine) throw new Error('The Census Gazetteer is empty.');
  const columns = headerLine.split('|');
  const stateIndex = columns.indexOf('USPS');
  const nameIndex = columns.indexOf('NAME');
  const legalStatisticalAreaIndex = columns.indexOf('LSAD');
  const functionalStatusIndex = columns.indexOf('FUNCSTAT');
  if ([stateIndex, nameIndex, legalStatisticalAreaIndex, functionalStatusIndex].some((index) => index < 0)) {
    throw new Error('The Census Gazetteer is missing a required column.');
  }

  const placesByState = new Map(states.map(({ code }) => [code, new Set()]));
  for (const line of recordLines) {
    if (!line) continue;
    const columnsForPlace = line.split('|');
    const stateCode = columnsForPlace[stateIndex];
    if (!stateCodes.has(stateCode)) continue;
    const name = columnsForPlace[nameIndex]?.trim();
    const legalStatisticalArea = columnsForPlace[legalStatisticalAreaIndex];
    const functionalStatus = columnsForPlace[functionalStatusIndex];
    if (!name || (legalStatisticalArea !== '57' && functionalStatus !== 'A')) continue;
    placesByState.get(stateCode).add(name);
  }
  return placesByState;
}

async function main() {
  const states = readStates(await readFile(statesSourcePath, 'utf8'));
  const gazetteer = await downloadGazetteer();
  const placesByState = parsePlaces(gazetteer, states);
  await mkdir(outputDirectory, { recursive: true });

  let totalPlaces = 0;
  for (const { code } of states) {
    const cities = [...placesByState.get(code)].sort((left, right) => left.localeCompare(right, 'en'));
    if (cities.length === 0) throw new Error(`No Census places found for ${code}.`);
    const outputPath = path.join(outputDirectory, `${code}.json`);
    await writeFile(outputPath, `${JSON.stringify(cities, null, 2)}\n`, 'utf8');
    totalPlaces += cities.length;
    console.log(`${code}: ${cities.length}`);
  }
  console.log(`Generated ${totalPlaces} Census places across ${states.length} states in ${path.relative(projectRoot, outputDirectory)}.`);
}

main().catch((error) => {
  console.error('Failed to generate US city data:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
