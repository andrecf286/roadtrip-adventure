/**
 * A minimal streaming ZIP writer.
 *
 * Written rather than imported because the whole job here is ~120 lines and a
 * dependency in a Worker bundle is 120 lines plus a supply chain. Store method
 * only — every payload in this app is already-compressed JPEG, so DEFLATE would
 * spend CPU to add bytes.
 *
 * Streaming is the point. Each entry's bytes are handed over and released
 * before the next one is fetched, so the memory ceiling is one file rather than
 * the whole archive. Sizes and CRCs are therefore known before each local
 * header is written, which means no data descriptors and a simpler file.
 *
 * Not implemented, deliberately: ZIP64 (needed past 4GB or 65,535 entries;
 * this archive is single-digit megabytes and dozens of files) and encryption.
 * If either is ever needed, reach for a library instead of growing this.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* MS-DOS date/time, which is what a ZIP entry carries: seconds in 2s
   granularity, and a year counted from 1980. A date before 1980 cannot be
   represented at all, so it clamps rather than writing a negative year. */
function dosStamp(date) {
  const d = isNaN(date?.getTime?.()) ? new Date(0) : date;
  const y = Math.max(1980, d.getUTCFullYear());
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

/* Filenames a person will see in Finder and in Explorer. Strips the characters
   Windows refuses outright plus the separators that would silently create
   directories, and also `#` and `%` — those are legal in a filename and would
   survive happily into the archive, but the index page references these same
   files by RELATIVE URL, where `#` starts a fragment and `%` starts an escape.
   A badge called "Rock #1" produced a file that was present, correct, and
   showed as a broken image.

   The length cap counts UTF-8 BYTES, not JavaScript characters. NAME_MAX is
   255 bytes on ext4 and APFS alike, so a title in CJK or emoji can pass a
   120-character cap and still refuse to extract — an archive that validates
   and then fails to unpack, which is the worst shape this bug has. The cap
   also refuses to split a surrogate pair, because half of one becomes U+FFFD
   the moment it is encoded. */
const NAME_MAX_BYTES = 150;

export function safeName(s, fallback = "file") {
  let out = String(s == null ? "" : s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\/\\:*?"<>|#%]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "");

  if (utf8Len(out) > NAME_MAX_BYTES) {
    let end = out.length;
    while (end > 0 && utf8Len(out.slice(0, end)) > NAME_MAX_BYTES) end--;
    // Never end on a lone high surrogate.
    const code = out.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end--;
    out = out.slice(0, end).replace(/[\s.]+$/, "");
  }
  return out || fallback;
}

function utf8Len(s) {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/* Two badges may legitimately carry the same title, and two park names can
   reduce to the same filename once the illegal characters are replaced. A ZIP
   will happily hold both entries and every extractor then overwrites the first
   with the second, silently — seventeen entries in, fifteen files out. Callers
   run names through this so a collision becomes " (2)" instead of a
   disappearance. */
export function uniqueName(name, taken) {
  if (!taken.has(name)) { taken.add(name); return name; }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 2; i < 1000; i++) {
    const cand = stem + " (" + i + ")" + ext;
    if (!taken.has(cand)) { taken.add(cand); return cand; }
  }
  taken.add(name);
  return name;
}

const enc = new TextEncoder();

function u32(v) { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }
function u16(v) { return [v & 0xff, (v >>> 8) & 0xff]; }

/**
 * Build a ZIP as a ReadableStream.
 *
 * `entries` is an async iterable yielding { name, bytes (Uint8Array), date }.
 * Yielding lazily is what keeps the memory bounded — produce each entry's bytes
 * only when the iterator is pulled, and let them go afterwards.
 */
export function zipStream(entries) {
  const it = entries[Symbol.asyncIterator]();
  const dir = [];
  let offset = 0;
  let phase = "files";

  const bytesOf = (arr) => (arr instanceof Uint8Array ? arr : new Uint8Array(arr));

  function localHeader(nameBytes, crc, size, time, date) {
    return bytesOf([
      0x50, 0x4b, 0x03, 0x04,   // local file header
      20, 0,                     // version needed: 2.0
      ...u16(0x0800),            // flags: bit 11, names are UTF-8
      ...u16(0),                 // method: store
      ...u16(time), ...u16(date),
      ...u32(crc),
      ...u32(size),              // compressed == uncompressed
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0),                 // extra field length
    ]);
  }

  /* Everything happens in pull(), never in start(), and that is the whole
     point of this rewrite. `controller.enqueue` does not block and the queue is
     unbounded, so a producer that runs to completion inside start() buffers the
     entire archive in memory no matter how slowly the client reads — which is
     exactly the failure the streaming was supposed to avoid, and the first
     version of this file did it while carrying a comment claiming otherwise
     (measured: twelve 2MB entries all resident before the first read). pull()
     is called only when the consumer has room, so a phone on campground wifi
     now sets the pace and the ceiling really is one entry. */
  return new ReadableStream({
    async pull(controller) {
      if (phase === "files") {
        const { value: e, done } = await it.next();
        if (!done) {
          const nameBytes = enc.encode(e.name);
          const bytes = bytesOf(e.bytes);
          const crc = crc32(bytes);
          const { time, date } = dosStamp(e.date);
          const local = offset;
          const head = localHeader(nameBytes, crc, bytes.length, time, date);
          controller.enqueue(head);
          controller.enqueue(nameBytes);
          controller.enqueue(bytes);
          offset += head.length + nameBytes.length + bytes.length;
          dir.push({ nameBytes, crc, size: bytes.length, time, date, local });
          return;
        }
        phase = "dir";
      }

      /* The central directory and the end record are small and go out together
         — splitting them across pulls would buy nothing and a ZIP is only
         valid once both have landed. */
      const dirStart = offset;
      for (const d of dir) {
        const rec = bytesOf([
          0x50, 0x4b, 0x01, 0x02,   // central directory header
          20, 0,                     // version made by
          20, 0,                     // version needed
          ...u16(0x0800),
          ...u16(0),
          ...u16(d.time), ...u16(d.date),
          ...u32(d.crc),
          ...u32(d.size), ...u32(d.size),
          ...u16(d.nameBytes.length),
          ...u16(0), ...u16(0),      // extra, comment
          ...u16(0),                 // disk number
          ...u16(0),                 // internal attrs
          ...u32(0),                 // external attrs
          ...u32(d.local),
        ]);
        controller.enqueue(rec);
        controller.enqueue(d.nameBytes);
        offset += rec.length + d.nameBytes.length;
      }
      controller.enqueue(bytesOf([
        0x50, 0x4b, 0x05, 0x06,     // end of central directory
        ...u16(0), ...u16(0),
        ...u16(dir.length), ...u16(dir.length),
        ...u32(offset - dirStart),
        ...u32(dirStart),
        ...u16(0),                   // comment length
      ]));
      controller.close();
    },
    /* A ZIP is only valid once its central directory lands, and that is the
       last thing written — so a failure partway through cannot produce a file
       that looks complete and quietly is not. Erroring the stream gives the
       browser a truncated download it reports, which is the honest outcome. */
    async cancel(reason) { await it.return?.(reason); },
  });
}
