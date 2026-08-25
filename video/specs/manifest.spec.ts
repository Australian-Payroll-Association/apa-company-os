import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { getEpisode } from "../episodes";
import { episodeDir } from "../lib/env";

/**
 * Dumps the episode definition to out/<slug>/episode.json so the Node side of
 * the rig (voiceover, captions, assembly) reads one manifest instead of
 * importing TypeScript. Runs before anything else. No browser involved.
 */
test("write episode manifest", async () => {
  const episode = getEpisode(process.env.E8_EPISODE);
  const dir = episodeDir(episode.slug);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = {
    slug: episode.slug,
    number: episode.number,
    arc: episode.arc,
    title: episode.title,
    titleCardAfter: episode.titleCardAfter,
    endCard: episode.endCard,
    endCardSeconds: episode.endCardSeconds ?? null,
    beats: episode.beats.map((b) => ({
      id: b.id,
      vo: b.vo,
      captions: b.captions ?? null,
      hold: b.hold ?? 0,
      minSeconds: b.minSeconds ?? 0,
    })),
  };
  fs.writeFileSync(path.join(dir, "episode.json"), JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${path.join(dir, "episode.json")} (${manifest.beats.length} beats)`);
});
