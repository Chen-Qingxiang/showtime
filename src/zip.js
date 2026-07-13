const SIGNATURE_END = 0x06054b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_LOCAL = 0x04034b50;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const UTF8_FLAG = 0x0800;

function u16(view, offset) {
  return view.getUint16(offset, true);
}

function u32(view, offset) {
  return view.getUint32(offset, true);
}

function setU16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function setU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function findEndRecord(view) {
  const minimum = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (u32(view, offset) === SIGNATURE_END) return offset;
  }
  throw new Error('不是有效的 ZIP 文件');
}

export function listZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const endOffset = findEndRecord(view);
  const entryCount = u16(view, endOffset + 10);
  const directorySize = u32(view, endOffset + 12);
  const directoryOffset = u32(view, endOffset + 16);
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new Error('暂不支持 ZIP64 项目包');
  }
  const decoder = new TextDecoder('utf-8');
  const entries = [];
  let offset = directoryOffset;
  const limit = directoryOffset + directorySize;
  while (entries.length < entryCount && offset < limit) {
    if (u32(view, offset) !== SIGNATURE_CENTRAL) throw new Error('ZIP 中央目录损坏');
    const flags = u16(view, offset + 8);
    const method = u16(view, offset + 10);
    const crc = u32(view, offset + 16);
    const compressedSize = u32(view, offset + 20);
    const size = u32(view, offset + 24);
    const nameLength = u16(view, offset + 28);
    const extraLength = u16(view, offset + 30);
    const commentLength = u16(view, offset + 32);
    const localOffset = u32(view, offset + 42);
    if ([compressedSize, size, localOffset].includes(0xffffffff)) throw new Error('暂不支持 ZIP64 项目包');
    const nameBytes = new Uint8Array(arrayBuffer, offset + 46, nameLength);
    const name = decoder.decode(nameBytes);
    entries.push({ name, flags, method, crc, compressedSize, size, localOffset, directory: name.endsWith('/') });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { inflateRawSync } = await import('node:zlib');
    return new Uint8Array(inflateRawSync(bytes));
  }
  throw new Error('当前环境不支持 ZIP deflate 解压缩');
}

export async function readZipEntry(arrayBuffer, entry) {
  const view = new DataView(arrayBuffer);
  if (u32(view, entry.localOffset) !== SIGNATURE_LOCAL) throw new Error(`ZIP 文件头损坏：${entry.name}`);
  const nameLength = u16(view, entry.localOffset + 26);
  const extraLength = u16(view, entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(arrayBuffer, start, entry.compressedSize);
  if (entry.method === METHOD_STORED) return compressed.slice();
  if (entry.method === METHOD_DEFLATE) return inflateRaw(compressed);
  throw new Error(`不支持 ZIP 压缩方式 ${entry.method}：${entry.name}`);
}

export async function extractZip(arrayBuffer) {
  const entries = listZipEntries(arrayBuffer);
  const files = new Map();
  for (const entry of entries) {
    if (!entry.directory) files.set(entry.name, await readZipEntry(arrayBuffer, entry));
  }
  return { entries, files };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[value] = crc >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new TextEncoder().encode(String(value ?? ''));
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export function createZip(entries, options = {}) {
  const normalized = entries.map((entry) => {
    const name = new TextEncoder().encode(String(entry.name).replace(/^\/+/, ''));
    const data = asBytes(entry.data);
    return { name, data, crc: crc32(data), offset: 0 };
  });
  if (normalized.length > 0xffff) throw new Error('ZIP 条目过多');
  const stamp = dosDateTime(options.date);
  const locals = [];
  let localOffset = 0;
  for (const entry of normalized) {
    entry.offset = localOffset;
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    setU32(view, 0, SIGNATURE_LOCAL);
    setU16(view, 4, 20);
    setU16(view, 6, UTF8_FLAG);
    setU16(view, 8, METHOD_STORED);
    setU16(view, 10, stamp.time);
    setU16(view, 12, stamp.date);
    setU32(view, 14, entry.crc);
    setU32(view, 18, entry.data.length);
    setU32(view, 22, entry.data.length);
    setU16(view, 26, entry.name.length);
    locals.push(header, entry.name, entry.data);
    localOffset += header.length + entry.name.length + entry.data.length;
  }
  const central = [];
  let centralSize = 0;
  for (const entry of normalized) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    setU32(view, 0, SIGNATURE_CENTRAL);
    setU16(view, 4, 20);
    setU16(view, 6, 20);
    setU16(view, 8, UTF8_FLAG);
    setU16(view, 10, METHOD_STORED);
    setU16(view, 12, stamp.time);
    setU16(view, 14, stamp.date);
    setU32(view, 16, entry.crc);
    setU32(view, 20, entry.data.length);
    setU32(view, 24, entry.data.length);
    setU16(view, 28, entry.name.length);
    setU32(view, 42, entry.offset);
    central.push(header, entry.name);
    centralSize += header.length + entry.name.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  setU32(endView, 0, SIGNATURE_END);
  setU16(endView, 8, normalized.length);
  setU16(endView, 10, normalized.length);
  setU32(endView, 12, centralSize);
  setU32(endView, 16, localOffset);
  return concatBytes([...locals, ...central, end]);
}

export function zipText(files) {
  return createZip(Object.entries(files).map(([name, data]) => ({ name, data })));
}
