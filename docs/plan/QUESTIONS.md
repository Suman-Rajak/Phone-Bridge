# Questions

## H2 and H3 — Real-device pairing (T07)

Run the two pairing checks on a physical phone and laptop, then paste back the result for each network. Include the OS and browser versions, the connection time, whether the verification codes matched, and whether all three channels opened on both devices. [HTTPS setup](../ship/dev-https.md#enable-pairing-from-the-https-page) · [Device matrix](../test/device-matrix.md)

## H5 — SmartDoc sample access (T03 benchmark)

Zenodo returned HTTP 403 to the download command from the development environment. The official CC BY 4.0 sample requires no registration.

Download `sampleDataset.tar.gz` from the official record in a browser and place it in `.datasets/smartdoc-2015/` in the repository. Then run `pnpm bench:vision`, which validates the checksum, extracts the archive, and records the first measured baseline. [Official Zenodo record](https://zenodo.org/records/1230218) · [SmartDoc setup](../understand/datasets.md)

The same archive also unblocks T04S’s live `vision-bench` skill exercise.

## H6 — Codex GitHub code review (T15)

Enable the Codex GitHub integration’s code review for `Suman-Rajak/Phone-Bridge`, then confirm in the workspace that the repository is enabled. Codex can then request `@codex review` on the T15 review PR. The security review PR requires a human merge. [Repository](https://github.com/Suman-Rajak/Phone-Bridge) · [Human checkpoints](../ROADMAP.md#part-4--human-checkpoints-only-the-human-can-do-these)
