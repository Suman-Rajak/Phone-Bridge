import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const record = "https://zenodo.org/records/1230218";
const name = "sampleDataset.tar.gz";
const checksum = "1ee5b7c290d707bd51c59f0b1c1a36f5";
const cache = resolve(import.meta.dirname, "../.datasets/smartdoc-2015");
const archive = join(cache, name);
const sample = join(cache, "sample");

/** Fetch and unpack the official SmartDoc sample into the ignored cache. */
export async function downloadSmartDoc(): Promise<string> {
  if (existsSync(sample)) return sample;

  await mkdir(cache, { recursive: true });
  const staging = await mkdtemp(join(cache, "smartdoc-"));
  try {
    const cached = existsSync(archive);
    let bytes: Buffer;
    if (cached) {
      bytes = await readFile(archive);
    } else {
      const response = await fetch(record + "/files/" + name + "?download=1", {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(
          "Zenodo returned HTTP " +
            response.status +
            ". Download " +
            name +
            " from " +
            record +
            " and place it in " +
            cache +
            ".",
        );
      }
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash("md5").update(bytes).digest("hex") !== checksum) {
      throw new Error(
        "SmartDoc archive checksum mismatch. Use the official sample archive from " +
          record +
          ".",
      );
    }
    if (!cached) {
      const downloaded = join(staging, name);
      await writeFile(downloaded, bytes);
      await rename(downloaded, archive);
    }
    const contents = join(staging, "contents");
    await mkdir(contents);
    execFileSync("tar", ["-xzf", archive, "-C", contents], {
      stdio: "inherit",
    });
    if (!existsSync(sample)) await rename(contents, sample);
    return sample;
  } finally {
    if (dirname(staging) === cache)
      await rm(staging, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    process.stdout.write((await downloadSmartDoc()) + "\n");
  } catch (error) {
    process.stderr.write(
      "SmartDoc sample unavailable: " +
        (error instanceof Error ? error.message : String(error)) +
        "\n",
    );
    process.exitCode = 1;
  }
}
