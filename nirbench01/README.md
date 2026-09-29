# NIRBENCH presentation

A portable HTML/CSS/JavaScript presentation matching the DeepLight Lab site's
navy/aqua palette, logo, Space Grotesk headings and Sora typography.

## Open the page

From the benchmark folder, start the local preview:

```bash
/home/dario/yes/envs/py3.13/bin/python -B website/serve.py
```

Open **http://127.0.0.1:8765/**. Use `--port 8766` if that port is occupied.
The server binds to localhost and reads the benchmark outputs. It never starts
training or modifies the original datasets, model results, or report. Its only
generated files are `website/data.js` and `website/data.json` at startup.

The browser checks the local `/api/results` endpoint every 30 seconds while
visible. The Refresh button also requests a current snapshot. Completed
TabPFN-3.5 datasets become available after their metrics, run records and protocol
file exist. A partially written or invalid result is omitted with a notice.

You can also open `index.html` directly from disk. It uses the included snapshot
and does not refresh from the benchmark folders. Charts and controls work offline;
Google Fonts are optional and fall back to installed sans-serif fonts.

## Refresh a portable copy

After new results finish, run:

```bash
/home/dario/yes/envs/py3.13/bin/python -B website/build_data.py
```

This uses `src/data_loading.py` to measure the actual cleaned train/test sizes,
and reads per-dataset metric CSVs plus `pls_baseline_benchmark.cvs`. It does not
rely on the potentially older global ranking CSV. No TensorFlow or TabPFN-3.5 model
is imported by the exporter or web server.

To place the page on the lab website, copy `index.html`, `styles.css`, `app.js`,
`data.js`, `data.json`, and `assets/` into a subdirectory such as `nirbench/`.
The page needs no npm build or external chart library. Static hosting displays
the exported snapshot; rerun the exporter and copy the two data files to update it.
The Python files are only needed for local export and preview.

## Content and comparison rules

- **Results:** 15-model ranking with PLS and TabPFN-3.5 enabled by default, controls to exclude either baseline,
  domain filters, per-dataset RMSE/R² plots with run standard deviations,
  a complete RMSE matrix, and CSV/JSON downloads.
- **Datasets:** all 30 configurations, material/target/domain labels and cleaned
  train/test/channel counts; search and domain filters.
- **Protocol:** shared fixed splits, DL epoch selection, joint PLS preprocessing
  and latent-variable selection, and TabPFN-3.5's ten seeded evaluations without CV.
- **Models:** all 15 implementations with family filters, linked Python source,
  and original-paper citations where the architecture is paper-derived. TabPFN-3.5
  and PLS link to their upstream package source; the three NIRBENCH 1D-CNN
  baselines are identified as repository designs.
- **Sources:** updated PDF, downloadable snapshot, and source paths carried with
  each result. The PDF is copied from `Report/report.pdf` after compilation.

The default ranking includes all 13 DL architectures plus PLS and TabPFN-3.5. For a selected
model set and domain, every ranked model uses the **same intersection of completed
datasets**. Ranks are calculated within each dataset from mean test RMSE; ties get
average ranks. Scores are `100 × (M − rank)/(M − 1)`, averaged across those datasets.
Excluding PLS or TabPFN-3.5 changes M and therefore the scores.

The page does not average raw RMSE across targets with different units. Dataset
plots and the matrix use original target units. Whiskers are ±1 sample standard
deviation across final runs, not confidence intervals. PLS has one final fit and
no recorded run variability. Its displayed time covers the five-fold joint
search over nine preprocessing variants and 1–20 latent variables; DL and
TabPFN-3.5 uses its recorded final-evaluation timings. All runtimes were measured
locally on the Apollo workstation with a 13th Gen Intel Core i9-13900K CPU and
an NVIDIA GeForce RTX 2080 Ti GPU (11 GB), so the displayed values are
comparative measurements of the benchmark protocols.

Dataset configurations can share underlying samples; counts are not a count of
independent collections. Display labels are maintained in `build_data.py` while
sample counts and metrics are always read from the repository. The hero illustrates
eight actual, unprocessed wheat-flour training spectra from the stored CSV.

CSV export follows the current view: ranking exports include model set and shared
dataset IDs; detail/matrix exports include underlying rows and source paths.
The JSON download exports the currently displayed snapshot, including live updates.

## Files

- `index.html`, `styles.css`, `app.js`: presentation and interactions.
- `build_data.py`: traceable snapshot export; stable reads during benchmark writes.
- `serve.py`: optional localhost server with read-only live results.
- `data.js`, `data.json`: generated portable snapshot.
- `assets/lab-logo.png`: copied from the lab's supplied website.
- `assets/benchmark-report.pdf`: copied from the updated `Report/report.pdf`.
- `assets/*.py`: inspectable Python implementations linked from the model cards.
- Model-card paper citations resolve through DOI links to the publishers; paper
  PDFs are not included in the website assets.
