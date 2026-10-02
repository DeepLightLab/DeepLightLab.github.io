"""Export a read-only, traceable snapshot of NIRBENCH into the presentation site."""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

# Display labels only; counts and measurements always come from repository data.
DATASETS = [
    ("Wheat kernels", "Protein", "Grains"),
    ("Wheat flour", "Protein", "Grains"),
    ("Tecator meat", "Moisture", "Food & dairy"),
    ("Grain · CGL", "Glucose", "Grains"),
    ("Cucurbitaceae fruit", "Soluble solids", "Fruit & vegetables"),
    *[(f"Tomato · set {i}", "Soluble solids", "Fruit & vegetables") for i in range(1, 6)],
    ("Olive oil", "C16 fatty acid", "Food & dairy"),
    ("Diesel fuel", "Cetane number", "Fuels"),
    ("Milk", "Protein", "Food & dairy"),
    ("Pharmaceutical tablets", "Assay", "Pharmaceuticals"),
    ("Pear · 2021", "Brix", "Fruit & vegetables"),
    ("Pear · 2019", "Brix", "Fruit & vegetables"),
    ("Barley · Perten", "Moisture", "Grains"),
    ("Barley · Perten", "Protein", "Grains"),
    ("Wheat · Grainit", "Moisture", "Grains"),
    ("Wheat · Grainit", "Protein", "Grains"),
    ("Pear · 2021 · SNV", "Brix", "Fruit & vegetables"),
    *[(f"Mango · S{i}", "Dry matter", "Fruit & vegetables") for i in range(1, 5)],
    ("Corn · Perten", "Moisture", "Grains"),
    ("Corn · Perten", "Protein", "Grains"),
    ("Wheat · Perten", "Moisture", "Grains"),
    ("Wheat · Perten", "Protein", "Grains"),
    ("Wheat · CRAW", "Protein", "Grains"),
]

MODELS = [
    ("IPA", "IPA", "CNN", "Compact Inception network", "A compact convolutional network with parallel Inception branches with different kernel sizes.", "models/IPA.py", "assets/IPA.py", "Haffner et al. (2025), IPA: A deep CNN based on Inception for Petroleum Analysis, Fuel 379, 133016.", "https://doi.org/10.1016/j.fuel.2024.133016"),
    ("1D-CNN_1L_3", "1D-CNN · 1L–3", "CNN", "One wide convolution", "One convolutional filter with a 31-channel kernel, followed by a 128 → 64 → 16 dense head.", "models/CNN_1D_1L_3.py", "assets/CNN_1D_1L_3.py", "CNN baseline architecture; Used in different papers.", None),
    ("1D-CNN_1N_3", "1D-CNN · 1N–3", "CNN", "One narrow convolution", "One convolutional filter with a 5-channel kernel and the same dense head as the wide-kernel baseline.", "models/CNN_1D_1N_3.py", "assets/CNN_1D_1N_3.py", "CNN baseline architecture; Used in different papers.", None),
    ("1D-CNN_3_1", "1D-CNN · 3–1", "CNN", "Three convolutional blocks", "A sequential baseline with 16, 32 and 64 filters, pooling, global average pooling and a dense regression head.", "models/CNN_1D_3_1.py", "assets/CNN_1D_3_1.py", "CNN baseline architecture; Used in different papers", None),
    ("DeepSpectra", "DeepSpectra", "CNN", "Multiple spectral scales", "An Inception-style 1D CNN that combines convolutional kernels at several scales, with dropout and L2 regularization.", "models/DeepSpectra.py", "assets/DeepSpectra.py", "Zhang et al. (2019), DeepSpectra: An end-to-end deep learning approach for quantitative spectral analysis, Analytica Chimica Acta 1058, 48–57.", "https://doi.org/10.1016/j.aca.2019.01.002"),
    ("1DInceptionResnet", "1D Inception-ResNet", "CNN", "Inception meets residual learning", "A deeper convolutional architecture combining parallel Inception branches with residual connections.", "models/1DInceptionResnet.py", "assets/1DInceptionResnet.py", "Tan et al. (2023), 1D-inception-resnet for NIR quantitative analysis and its transferability between different spectrometers, Infrared Physics & Technology 129, 104559.", "https://doi.org/10.1016/j.infrared.2023.104559"),
    ("ResidualSpectra", "ResidualSpectra", "CNN", "Residual spectral features", "A residual convolutional network adapted to continuous, single-target prediction from spectra.", "models/ResidualSpectra.py", "assets/ResidualSpectra.py", "Wang et al. (2020), End-to-end analysis modeling of vibrational spectroscopy based on deep learning approach, Journal of Chemometrics, e3291.", "https://doi.org/10.1002/cem.3291"),
    ("SpectraNet32", "SpectraNet32", "CNN", "Residual CNN", "A residual spectral network adapted to single-output regression, with parametric GELU, dropout and regularization.", "models/SpectraNet32.py", "assets/SpectraNet32.py", "Martins et al. (2023), Estimation of soluble solids content and fruit temperature in ‘Rocha’ pear using Vis-NIR spectroscopy and the SpectraNet–32 deep learning architecture, Postharvest Biology and Technology 199, 112281.", "https://doi.org/10.1016/j.postharvbio.2023.112281"),
    ("SpectraNet53", "SpectraNet53", "CNN", "Deep spectral CNN", "A deeper spectral CNN with PReLU/GELU activations, dropout, L2 regularization and gradient clipping.", "models/SpectraNet53.py", "assets/SpectraNet53.py", "Martins et al. (2022), SpectraNet–53: A deep residual learning architecture for predicting soluble solids content with VIS–NIR spectroscopy, Computers and Electronics in Agriculture 197, 106945.", "https://doi.org/10.1016/j.compag.2022.106945"),
    ("MarkSpectra", "MarkSpectra", "Dense", "Select spectral marks", "The benchmark implementation selects informative wavelength marks and fits a compact dense regression network.", "models/MarkSpectra.py", "assets/MarkSpectra.py", "Wang et al. (2022), Mark-Spectra: A convolutional neural network for quantitative spectral analysis overcoming spatial relationships, Computers and Electronics in Agriculture 192, 106624.", "https://doi.org/10.1016/j.compag.2021.106624"),
    ("SCNet", "SCNet", "CNN", "Multiscale shortcut CNN", "A multiscale convolutional network that pools and concatenates features from successive convolution stages before the dense regression head.", "models/SCNet.py", "assets/SCNet.py", "Li et al. (2023), SCNet: A deep learning network framework for analyzing near-infrared spectroscopy using short-cut, Infrared Physics & Technology 132, 104731.", "https://doi.org/10.1016/j.infrared.2023.104731"),
    ("Spectraformer", "Spectraformer", "Attention", "Convolutions + attention", "Convolutional feature extraction combined with Transformer blocks for spectral regression.", "models/Spectraformer.py", "assets/Spectraformer.py", "Chen, Zhou & Ren (2024), Spectraformer: deep learning model for grain spectral qualitative analysis based on transformer structure, RSC Advances 14, 8053–8066.", "https://doi.org/10.1039/D3RA07708J"),
    ("SpectraTr", "SpectraTr", "Attention", "Spectra as patches", "A vision-Transformer-style architecture with patching adjusted to each dataset’s spectral length.", "models/SpectraTr.py", "assets/SpectraTr.py", "Fu et al. (2022), SpectraTr: A novel deep learning model for qualitative analysis of drug spectroscopy based on transformer structure, Journal of Innovative Optical Health Sciences 15, 2250021.", "https://doi.org/10.1142/S1793545822500213"),
    ("TabPFN35", "TabPFN-3.5", "Foundation", "Pretrained tabular regressor", "Frozen pretrained weights use the full training set as context. Ten seeds vary its internal ensemble; no epoch selection or CV is performed. Free model available from PriorLabs.", "benchmark_tabpfn.py", "https://github.com/PriorLabs/TabPFN/blob/main/src/tabpfn/regressor.py", "Hollmann et al. (2025), Accurate predictions on small data with a tabular foundation model, Nature 637, 319–326.", "https://doi.org/10.1038/s41586-024-08328-6"),
    ("PLSRegression", "PLS regression", "Classical", "The optimized chemometric reference", "Five-fold training-set CV jointly selects one of nine spectral preprocessings and 1–20 latent variables before a final fit on the full training split. Using Scikit-Learn implementation.", "pls_baseline.py", "https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/cross_decomposition/_pls.py", "Wold, Sjöström & Eriksson (2001), PLS-regression: a basic tool of chemometrics, Chemometrics and Intelligent Laboratory Systems 58, 109–130.", "https://doi.org/10.1016/S0169-7439(01)00155-1"),
]


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def numeric(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def stable_csv(path):
    before = path.stat()
    text = path.read_text(encoding="utf-8")
    after = path.stat()
    if (before.st_mtime_ns, before.st_size) != (after.st_mtime_ns, after.st_size):
        raise ValueError("file is being updated")
    return list(csv.DictReader(text.splitlines()))


def collect_results(dataset_ids):
    rows, warnings = [], []
    for model_id, *_ in MODELS:
        if model_id == "PLSRegression":
            continue
        for dataset_id in dataset_ids:
            path = ROOT / "results" / model_id / f"{dataset_id}_metrics.csv"
            if not path.exists():
                continue
            try:
                source = stable_csv(path)
                if len(source) != 1 or source[0].get("dataset_name") != dataset_id:
                    raise ValueError("incomplete or mismatched metric row")
                row = source[0]
                rmse, r2 = numeric(row.get("test_rmse_mean")), numeric(row.get("test_R2_mean"))
                if rmse is None or rmse < 0 or r2 is None:
                    raise ValueError("missing test measurements")
                runs = 10
                if model_id == "TabPFN35":
                    protocol_path = path.with_name(f"{dataset_id}_protocol.json")
                    run_path = path.with_name(f"{dataset_id}_runs.csv")
                    if not protocol_path.exists() or not run_path.exists():
                        continue  # The active runner has not committed this dataset yet.
                    protocol = json.loads(protocol_path.read_text())
                    runs = int(protocol["runs"])
                    run_rows = stable_csv(run_path)
                    if len(run_rows) != runs:
                        raise ValueError("final runs are incomplete")
                rows.append({
                    "dataset": dataset_id, "model": model_id,
                    "rmse": rmse, "rmseStd": numeric(row.get("test_rmse_std")),
                    "r2": r2, "r2Std": numeric(row.get("test_R2_std")),
                    "seconds": numeric(row.get("avg_wall_time_s")), "runs": runs,
                    "source": path.relative_to(ROOT).as_posix(),
                })
            except (OSError, ValueError, KeyError) as exc:
                warnings.append(f"{model_id} / {dataset_id}: {exc}")
    path = ROOT / "pls_baseline_benchmark.cvs"
    try:
        for row in stable_csv(path):
            if row["dataset"] not in dataset_ids:
                continue
            rmse, r2 = numeric(row["RMSE test"]), numeric(row["R2 test"])
            if rmse is None or r2 is None or rmse < 0:
                raise ValueError("invalid PLS measurement")
            rows.append({"dataset": row["dataset"], "model": "PLSRegression",
                         "rmse": rmse, "r2": r2, "rmseStd": None, "r2Std": None,
                         "seconds": numeric(row.get("optimization_time_s")), "runs": 1,
                         "preprocessing": row.get("preprocessing"),
                         "lv": numeric(row["LV"]), "cvRmse": numeric(row["RMSE-CV"]),
                         "cvR2": numeric(row.get("R2-CV")), "source": path.name})
    except (OSError, ValueError, KeyError) as exc:
        warnings.append(f"PLS: {exc}")
    keys = [(r["dataset"], r["model"]) for r in rows]
    if len(keys) != len(set(keys)):
        raise ValueError("duplicate model/dataset measurements")
    for row in rows:
        task_number = int(row["dataset"].split("-", 1)[0])
        if not 22 <= task_number <= 25:
            continue
        newest_split = max((ROOT / "datasets" / row["dataset"] / f"data_{split}.csv").stat().st_mtime_ns
                           for split in ("train", "test"))
        row["predatesCurrentSplit"] = (ROOT / row["source"]).stat().st_mtime_ns < newest_split
        row["splitStatus"] = "previous split" if row["predatesCurrentSplit"] else "current split"
    return rows, warnings


def build_snapshot():
    import numpy as np
    from src.data_loading import discover_datasets, load_dataset

    config = discover_datasets(ROOT / "datasets")
    datasets, hero = [], None
    for name in sorted(config, key=lambda s: int(s.split("-", 1)[0])):
        idx = int(name.split("-", 1)[0])
        label, target, domain = DATASETS[idx - 1]
        x, y, xt, yt, wl = load_dataset(name, dataset_config=config, datasets_root=ROOT / "datasets")
        datasets.append({"id": name, "number": idx, "label": label, "target": target,
                         "domain": domain, "train": len(y), "test": len(yt),
                         "features": int(x.shape[1]), "source": f"datasets/{name}/"})
        if idx == 2:
            # Actual unprocessed values; a presentation illustration, not a fitted result.
            picks = np.linspace(0, len(x) - 1, 8, dtype=int)
            hero = {"x": wl.tolist(), "series": x[picks].tolist(),
                    "source": "2-Wheat_flours_protein", "label": "Wheat flour · eight training spectra"}
    rows, warnings = collect_results({d["id"] for d in datasets})
    return {"schemaVersion": 1, "generatedAt": utc_now(), "datasets": datasets,
            "models": [{"id": m[0], "name": m[1], "family": m[2], "subtitle": m[3],
                        "description": m[4], "source": m[5], "codeHref": m[6],
                        "citation": m[7], "paperHref": m[8]} for m in MODELS],
            "results": rows, "hero": hero, "warnings": warnings,
            "provenance": {
                "measurements": "Per-dataset results/<model>/*_metrics.csv; PLS from pls_baseline_benchmark.cvs",
                "population": "30 task configurations. Mango tasks 22–25 use seed-42 80/20 splits of inferred fruit groups (equal DM within each season). Some tasks share samples, targets or instruments.",
                "uncertainty": "Sample standard deviation across final seeded runs, not a confidence interval. PLS is one fit.",
                "ranking": "Mean of 100 × (M − rank)/(M − 1), with average ties, on shared datasets only.",
                "time": "Comparative wall time measured on a common Windows 11 workstation (Intel Core i9-13900K and NVIDIA GeForce RTX 2080 Ti, WSL2, TensorFlow 2.20). DL records each final fit plus train/test prediction; TabPFN-3.5 records fit plus test prediction; PLS records its five-fold joint preprocessing and latent-variable optimization.",
            }}


def export_snapshot():
    snapshot = build_snapshot()
    encoded = json.dumps(snapshot, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    for filename, text in [("data.json", encoded + "\n"), ("data.js", "window.NIRBENCH_DATA = " + encoded + ";\n")]:
        path = SITE / filename
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(path)
    print(f"Exported {len(snapshot['datasets'])} datasets and {len(snapshot['results'])} results to {SITE}")
    for warning in snapshot["warnings"]:
        print(f"Skipped: {warning}")
    return snapshot


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    export_snapshot()
