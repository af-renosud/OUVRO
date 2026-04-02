/**
 * Unit tests for defaultTranscribeVideo and normalizeVideoMimeType.
 *
 * These tests inject mock deps so no real network, Gemini, or filesystem
 * operations are performed. They cover:
 *   - normalizeVideoMimeType: codec/container normalization
 *   - PROCESSING → ACTIVE happy path
 *   - FAILED polling state throws
 *   - 2 GB size guardrail from Content-Length header
 *   - /tmp cleanup on success and on thrown error
 *
 * Run: npx tsx --test server/routes/__tests__/dqe-transcribe.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTranscribeVideo,
  normalizeVideoMimeType,
  type TranscribeVideoDepsInternal,
} from "../dqe.ts";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeHeaders(
  map: Record<string, string> = {},
): Pick<Response, "headers"> {
  return {
    headers: {
      get: (name: string) => map[name.toLowerCase()] ?? null,
    } as unknown as Headers,
  };
}

/** Minimal passthrough write stream that discards bytes. */
function makeNullWriteStream(): NodeJS.WritableStream {
  const { Writable } = require("node:stream") as typeof import("node:stream");
  return new Writable({ write(_chunk, _enc, cb) { cb(); } });
}

/** Builds a deps object filled with happy-path defaults, allowing overrides. */
function makeDeps(overrides: Partial<TranscribeVideoDepsInternal> = {}): TranscribeVideoDepsInternal {
  let tempCreated = false;

  const defaults: TranscribeVideoDepsInternal = {
    doHead: async () => ({ ok: true, ...makeHeaders({ "content-length": String(10 * 1024 * 1024) }) }),
    doGet: async () => ({
      ok: true,
      status: 200,
      body: require("node:stream").Readable.from(["dummy-video-bytes"]),
    }),
    filesUpload: async () => ({ name: "files/test-file-123" }),
    filesGet: async () => ({ state: "ACTIVE", uri: "https://gemini.test/files/test-file-123", mimeType: "video/mp4" }),
    doGenerate: async () => "Fissure au niveau du linteau.",
    mkWriteStream: (_path: string) => {
      tempCreated = true;
      return makeNullWriteStream();
    },
    runPipeline: async () => {},
    fileExists: (_path: string) => tempCreated,
    fileUnlink: (_path: string) => { tempCreated = false; },
    pollIntervalMs: 0,
  };

  return { ...defaults, ...overrides };
}

// ── normalizeVideoMimeType ────────────────────────────────────────────────────

describe("normalizeVideoMimeType", () => {
  const cases: Array<[string, string]> = [
    // HEVC / hvc1
    ["video/mp4; codecs=\"hvc1\"", "video/mp4"],
    ["video/mp4;codecs=hvc1",      "video/mp4"],
    ["video/hevc",                 "video/mp4"],
    ["video/h265",                 "video/mp4"],
    // H.264 / avc1
    ["video/mp4; codecs=\"avc1\"", "video/mp4"],
    ["video/mp4;codecs=avc1",      "video/mp4"],
    ["video/h264",                 "video/mp4"],
    // Apple QuickTime container
    ["video/quicktime",            "video/mp4"],
    ["video/x-quicktime",          "video/mp4"],
    // Plain mp4 — pass-through
    ["video/mp4",                  "video/mp4"],
    // Other recognised video types — strip codec params
    ["video/webm; codecs=vp9",     "video/webm"],
    ["video/ogg",                  "video/ogg"],
  ];

  for (const [input, expected] of cases) {
    it(`normalizes "${input}" → "${expected}"`, () => {
      assert.equal(normalizeVideoMimeType(input), expected);
    });
  }
});

// ── defaultTranscribeVideo ────────────────────────────────────────────────────

describe("defaultTranscribeVideo", () => {
  it("returns transcription text on happy path (PROCESSING → ACTIVE)", async () => {
    let pollCalls = 0;
    const deps = makeDeps({
      filesGet: async () => {
        pollCalls++;
        if (pollCalls < 3) return { state: "PROCESSING", uri: undefined, mimeType: undefined };
        return { state: "ACTIVE", uri: "https://gemini.test/files/abc", mimeType: "video/mp4" };
      },
      doGenerate: async (fileUri) => {
        assert.equal(fileUri, "https://gemini.test/files/abc");
        return "Fissure au niveau du linteau.";
      },
    });

    const result = await defaultTranscribeVideo("https://cdn.test/video.mp4", "video/mp4", deps);
    assert.equal(result, "Fissure au niveau du linteau.");
    assert.equal(pollCalls, 3, "should poll until ACTIVE (2 PROCESSING + 1 ACTIVE)");
  });

  it("normalizes hvc1 MIME type before upload", async () => {
    let uploadedMime = "";
    const deps = makeDeps({
      filesUpload: async (_path, mimeType) => {
        uploadedMime = mimeType;
        return { name: "files/hvc1-test" };
      },
    });

    await defaultTranscribeVideo("https://cdn.test/video.mp4", "video/mp4;codecs=hvc1", deps);
    assert.equal(uploadedMime, "video/mp4", "hvc1 codec should be normalised to video/mp4 before upload");
  });

  it("normalizes avc1 MIME type before upload", async () => {
    let uploadedMime = "";
    const deps = makeDeps({
      filesUpload: async (_path, mimeType) => {
        uploadedMime = mimeType;
        return { name: "files/avc1-test" };
      },
    });

    await defaultTranscribeVideo("https://cdn.test/video.mp4", "video/mp4;codecs=avc1", deps);
    assert.equal(uploadedMime, "video/mp4");
  });

  it("throws when video exceeds the 2 GB size guardrail from Content-Length", async () => {
    const tooBig = 2.1 * 1024 * 1024 * 1024;
    const deps = makeDeps({
      doHead: async () => ({
        ok: true,
        ...makeHeaders({ "content-length": String(tooBig) }),
      }),
    });

    await assert.rejects(
      () => defaultTranscribeVideo("https://cdn.test/big.mp4", "video/mp4", deps),
      (err: Error) => {
        assert.ok(err.message.includes("2 GB"), `expected '2 GB' in: ${err.message}`);
        return true;
      },
    );
  });

  it("throws when Gemini Files API returns FAILED state", async () => {
    const deps = makeDeps({
      filesGet: async () => ({ state: "FAILED", uri: undefined, mimeType: undefined }),
    });

    await assert.rejects(
      () => defaultTranscribeVideo("https://cdn.test/video.mp4", "video/mp4", deps),
      (err: Error) => {
        assert.ok(
          err.message.toLowerCase().includes("failed"),
          `expected 'failed' in: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("cleans up /tmp file after successful transcription", async () => {
    const deleted: string[] = [];
    let created: string | undefined;

    const deps = makeDeps({
      mkWriteStream: (path) => {
        created = path;
        return makeNullWriteStream();
      },
      fileExists: (path) => path === created,
      fileUnlink: (path) => { deleted.push(path); },
    });

    await defaultTranscribeVideo("https://cdn.test/video.mp4", "video/mp4", deps);

    assert.ok(created, "temp path should have been created");
    assert.deepEqual(deleted, [created], "temp path should be deleted exactly once");
  });

  it("cleans up /tmp file even when transcription throws", async () => {
    const deleted: string[] = [];
    let created: string | undefined;

    const deps = makeDeps({
      mkWriteStream: (path) => {
        created = path;
        return makeNullWriteStream();
      },
      fileExists: (path) => path === created,
      fileUnlink: (path) => { deleted.push(path); },
      doGenerate: async () => {
        throw new Error("Gemini error");
      },
    });

    await assert.rejects(
      () => defaultTranscribeVideo("https://cdn.test/video.mp4", "video/mp4", deps),
      /Gemini error/,
    );

    assert.ok(created, "temp path should have been created");
    assert.deepEqual(deleted, [created], "temp path should be deleted even after error");
  });

  it("throws when video download returns non-OK status", async () => {
    const deps = makeDeps({
      doGet: async () => ({ ok: false, status: 403, body: null }),
    });

    await assert.rejects(
      () => defaultTranscribeVideo("https://cdn.test/video.mp4", "video/mp4", deps),
      /403/,
    );
  });
});
