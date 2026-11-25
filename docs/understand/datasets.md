# SmartDoc vision benchmark data

Use the **SmartDoc 2015 Challenge 1 original sample**, version 1.0.0, available in `sampleDataset.tar.gz` (21.2 MB). The competition organizers publish an MD5 of `1ee5b7c290d707bd51c59f0b1c1a36f5` for this archive. The download requires no account. [Official Zenodo record](https://zenodo.org/records/1230218)

The organizers license the dataset under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution goes to Jean-Christophe Burie, Joseph Chazalon, Mickaël Coustaty, Sébastien Eskenazi, Muhammad Muzzamil Luqman, Maroua Mehri, Nibal Nayef, Jean-Marc Ogier, Sophea Prum, and Marçal Rusiñol, _ICDAR2015 Competition on Smartphone Document Capture and OCR (SmartDoc)_, 2015. [Competition paper](https://doi.org/10.1109/ICDAR.2015.7333943) · [Dataset license](https://smartdoc.univ-lr.fr/smartdoc-2015-challenge-1/smartdoc-2015-challenge-1-dataset/)

## Run the benchmark

Install FFmpeg with both `ffmpeg` and `ffprobe` on PATH, and make sure `tar` is available. Run `pnpm bench:vision` from the repository root. It downloads, validates, and extracts the sample under the ignored `.datasets/smartdoc-2015/` directory. Run `pnpm data:smartdoc` to download the sample ahead of the benchmark. [FFmpeg downloads](https://ffmpeg.org/download.html)

If Zenodo blocks the command-line download, download `sampleDataset.tar.gz` from the official record in your browser and put it in `.datasets/smartdoc-2015/`. The same benchmark command verifies and extracts the local copy. Keep downloaded or extracted data out of Git.

The benchmark processes eligible annotated frames nearest the 25%, 50%, and 75% positions in each sample video, deduplicates short sequences, and uses the raw frame orientation from the source video. A missed detection scores zero. It prints mean polygon IoU and creates the initial `bench/baseline.json` after a successful run. Subsequent runs preserve an existing baseline.
