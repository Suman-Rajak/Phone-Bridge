# Questions

## H5 — SmartDoc sample access (T03 benchmark)

Zenodo returned HTTP 403 to the download command from the development environment. The official CC BY 4.0 sample requires no registration.

Download `sampleDataset.tar.gz` from the official record in a browser and place it in `.datasets/smartdoc-2015/` in the repository. Then run `pnpm bench:vision`, which validates the checksum, extracts the archive, and records the first measured baseline. [Official Zenodo record](https://zenodo.org/records/1230218) · [SmartDoc setup](../understand/datasets.md)

The same archive also unblocks T04S’s live `vision-bench` skill exercise.
