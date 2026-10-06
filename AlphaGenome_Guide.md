# AlphaGenome — A Practical Technical Guide

*From installation to variant scoring, splicing analysis, batch pipelines and the Atlas.*
*Last checked against the `alphagenome` Python package v0.9.x and alphagenomedocs.com, October 2026.*

---

## Contents

1. [What AlphaGenome is (and isn't)](#1-what-alphagenome-is-and-isnt)
2. [AlphaGenome vs AlphaFold vs AlphaMissense](#2-alphagenome-vs-alphafold-vs-alphamissense)
3. [Ways to access the model](#3-ways-to-access-the-model)
4. [Installation and API key](#4-installation-and-api-key)
5. [Core concepts you must get right](#5-core-concepts-you-must-get-right)
6. [Recipes (code)](#6-recipes-code)
7. [Use-case catalogue](#7-use-case-catalogue)
8. [Interpreting scores — best practices](#8-interpreting-scores--best-practices)
9. [Limitations](#9-limitations)
10. [Troubleshooting and quotas](#10-troubleshooting-and-quotas)
11. [Resources and citation](#11-resources-and-citation)

---

## 1. What AlphaGenome is (and isn't)

AlphaGenome (Google DeepMind; Avsec et al., *Nature* 2026) is a sequence-to-function deep learning model. It takes **up to 1 Mb of DNA sequence** and predicts thousands of **functional genomic tracks**, mostly at **single-base resolution**, for human (hg38) and mouse (mm10).

**Input:** one DNA sequence (or genomic interval) of 16 kb, ~100 kb, ~500 kb or 1 Mb.
**Output:** predicted experimental signals across hundreds of cell types and tissues, plus variant-effect scores (ALT − REF).

**It does NOT:** predict protein structure, protein function, or patient-level phenotypes. It is not diploid-aware and is not a clinical diagnostic tool.

### 1.1 Output types (human model)

| `OutputType` | What it predicts | Resolution | Human tracks |
|---|---|---|---|
| `RNA_SEQ` | Gene expression (polyA+ and total RNA; some stranded) | 1 bp | 667 |
| `CAGE` | TSS activity (Cap Analysis of Gene Expression) | 1 bp | 546 |
| `PROCAP` | TSS activity (PRO-cap) | 1 bp | 12 |
| `DNASE` | Chromatin accessibility (DNase-seq) | 1 bp | 305 |
| `ATAC` | Chromatin accessibility (ATAC-seq) | 1 bp | 167 |
| `CHIP_HISTONE` | 24 histone marks (H3K27ac, H3K4me3, …) | 128 bp | 1,116 |
| `CHIP_TF` | Binding of 43 transcription factors | 128 bp | 1,617 |
| `SPLICE_SITES` | Donor/acceptor probability per base | 1 bp | 4 |
| `SPLICE_SITE_USAGE` | Fraction of transcripts using each site | 1 bp | 734 |
| `SPLICE_JUNCTIONS` | Junction read counts (≤512 donors × 512 acceptors per strand) | 1 bp | 734 |
| `CONTACT_MAPS` | 3D contacts (Hi-C/Micro-C, distance-normalised) | 2,048 bp | 28 |

Track counts differ for mouse. Query them with `dna_model.output_metadata(...)` (see §6.1).

### 1.2 Model versions

- `ModelVersion.ALL_FOLDS` (the default): a distilled student model trained from an ensemble of teachers. Use this one.
- `FOLD_0` … `FOLD_3`: each has one quarter of the genome held out. Use these only for benchmarking on held-out regions.

---

## 2. AlphaGenome vs AlphaFold vs AlphaMissense

These three DeepMind models answer different questions. People often mix them up.

| | **AlphaGenome** | **AlphaFold (2/3)** | **AlphaMissense** |
|---|---|---|---|
| Question answered | What does this DNA *do* in this cell type, and what changes when I mutate it? | What 3D structure does this protein (or complex) adopt? | Is this amino-acid substitution likely pathogenic? |
| Input | DNA sequence, 16 kb–1 Mb | Protein sequence(s); AF3 also takes DNA/RNA, ligands, ions and PTMs | Missense variant (protein position + AA change) |
| Output | Expression, splicing, accessibility, histone marks, TF binding, 3D contacts; variant deltas | Atomic coordinates + confidence (pLDDT, PAE, ipTM) | Pathogenicity score from 0 to 1 |
| Genome scope | Coding + **non-coding** (~98% of genome) | Protein-coding only | Missense only |
| Access | Free API (non-commercial), Atlas portal, weights for local use | AlphaFold Server (AF3, non-commercial), AF3 code + weights on academic request, AlphaFold DB | Precomputed tables (≈71M variants), AlphaFold DB annotations |

### 2.1 How to combine them: variant to structure

A typical workflow for a variant near an exon:

1. **AlphaGenome:** score the variant for splicing (§6.6). Is a donor or acceptor lost, a cryptic site created, or an exon skipped?
2. **AlphaGenome:** inspect the predicted junctions (sashimi plot, PSI) to reconstruct the likely aberrant transcript.
3. **Translate** the aberrant transcript yourself (Biopython/EMBOSS). Does it keep the frame or create an in-frame deletion? Is there a premature stop codon (PTC)? A PTC that sits more than ~50–55 nt upstream of the last exon–exon junction usually triggers NMD.
4. **AlphaFold (Server/AF3):** for an in-frame isoform, predict the variant protein's structure. Compare it to the WT model in the AlphaFold DB (pLDDT, domain integrity, interfaces with partners).
5. **AlphaMissense:** if the variant is also missense, check its protein-level pathogenicity score.
6. **AlphaGenome Atlas (AVI score):** the AVI score already combines AlphaGenome's regulatory predictions with AlphaMissense into a single number for every possible SNV. Use it as a quick first pass.

> Rule of thumb: AlphaGenome tells you **whether and how the RNA changes**. AlphaFold tells you **what the resulting protein looks like**.

---

## 3. Ways to access the model

| Route | Best for | Cost / licence | Hardware |
|---|---|---|---|
| **AlphaGenome API** (`alphagenome` Python client) | Most users; up to thousands of predictions | Free, **non-commercial**; rate varies with demand | Any laptop, or Colab |
| **AlphaGenome Atlas** (web portal + `alphagenome.atlas` API) | Instant lookup of precomputed scores for all ~9 billion possible human SNVs; AVI score | Free for academic research | None |
| **Local weights** (`alphagenome_research`, JAX) | More than ~1M predictions, offline/private data, custom heads | Weights under non-commercial terms (Kaggle / Hugging Face) | NVIDIA H100-class GPU for inference |
| **Google Cloud** (Model Garden / Agent Platform) | Commercial use | Paid | Managed |

The API is "well suited for smaller to medium-scale analyses (1000s of predictions)" and "likely not suitable for … more than 1 million predictions". Above that scale, use local weights.

---

## 4. Installation and API key

### 4.1 Get an API key

1. Go to **https://deepmind.google.com/science/alphagenome** and request a key (requires accepting the non-commercial terms).
2. Store it as an environment variable. **Never hard-code it** in notebooks you share.

```bash
# ~/.bashrc or ~/.zshrc
export ALPHA_GENOME_API_KEY="your-key-here"
```

`alphagenome.colab_utils.get_api_key()` checks the `ALPHA_GENOME_API_KEY` environment variable first, then Colab secrets.

### 4.2 Install (Python ≥ 3.10)

**pip + venv (simplest):**

```bash
python -m venv ag-env
source ag-env/bin/activate        # Windows: ag-env\Scripts\activate
pip install -U alphagenome
```

**conda:**

```bash
conda create -n alphagenome python=3.11 -y
conda activate alphagenome
pip install -U alphagenome        # also available via: conda install -c bioconda alphagenome
```

**uv (fast):**

```bash
uv venv && source .venv/bin/activate
uv pip install alphagenome
```

**From source (latest/dev):**

```bash
git clone https://github.com/google-deepmind/alphagenome.git
pip install -e ./alphagenome
```

**Extras you will want for analysis:** `pip install jupyterlab pyfaidx pysam cyvcf2 seaborn`

### 4.3 Google Colab

1. Open a notebook and click 🔑 **Secrets** in the left panel.
2. Add a secret named `ALPHA_GENOME_API_KEY`, paste your key, and enable notebook access.
3. Run `!pip install alphagenome`.

### 4.4 Smoke test

```python
from alphagenome import colab_utils
from alphagenome.models import dna_client

dna_model = dna_client.create(colab_utils.get_api_key())

out = dna_model.predict_sequence(
    sequence='GATTACA'.center(dna_client.SEQUENCE_LENGTH_16KB, 'N'),
    requested_outputs=[dna_client.OutputType.DNASE],
    ontology_terms=['UBERON:0002048'],   # lung
)
print(out.dnase.values.shape)            # (16384, n_tracks)
```

If this prints a shape, everything works.

---

## 5. Core concepts you must get right

### 5.1 Coordinates: the #1 source of bugs

| Object | Convention | Example |
|---|---|---|
| `genome.Interval(chrom, start, end)` | **0-based, half-open** `[start, end)`, like BED | First base of chr1 = `Interval('chr1', 0, 1)` |
| `genome.Variant(chrom, position, ref, alt)` | **1-based** position, like VCF | Copy `POS` from a VCF directly |
| Genome build | **hg38** (GRCh38.p13) / **mm10** (GRCm38.p6) | LiftOver hg19 → hg38 first |
| Chromosome names | `'chr1'`, `'chrX'` (UCSC style) | `Variant.from_str` adds `chr` if missing |

```python
from alphagenome.data import genome
v = genome.Variant.from_str('chr22:36201698:A>C')   # format chrom:pos:REF>ALT
```

Always check that `REF` matches hg38 at that position, for example with `pyfaidx` or `alphagenome.io.fasta.FastaExtractor`.

### 5.2 Supported sequence lengths

```python
dna_client.SEQUENCE_LENGTH_16KB    # 16,384
dna_client.SEQUENCE_LENGTH_100KB   # 131,072
dna_client.SEQUENCE_LENGTH_500KB   # 524,288
dna_client.SEQUENCE_LENGTH_1MB     # 1,048,576  ← recommended
```

Use `interval.resize(L)` to grow or shrink an interval around its centre. This uses real flanking genome sequence, not padding. For variants, use `variant.reference_interval.resize(L)`.

**1 Mb gives the best results**, especially for gene-level expression and splicing. Use 16 kb for fast exploration and for ISM.

### 5.3 Ontology terms (cell type / tissue)

Tracks are tagged with ontology CURIEs:

- `UBERON:` = tissues (e.g. `UBERON:0002107` liver, `UBERON:0002048` lung)
- `CL:` = cell types (e.g. `CL:0000084` T cell)
- `EFO:` / `CLO:` = cell lines (e.g. `EFO:0002067` K562)

Pass `ontology_terms=[...]` to restrict predictions, which makes them faster and lighter. Pass `None` to get every track. Look up terms in the metadata (§6.1) or with EBI OLS (https://www.ebi.ac.uk/ols4).

### 5.4 Strand

Track metadata uses `+`, `-` or `.` (unstranded). Stranded RNA assays have two tracks per biosample. For a minus-strand gene, use `.filter_to_negative_strand()` or `.filter_to_nonpositive_strand()`, which keeps unstranded tracks too.

### 5.5 Key objects

| Object | Contains |
|---|---|
| `Output` | One attribute per output type (`.rna_seq`, `.dnase`, `.splice_junctions`, …) |
| `TrackData` | `.values` (np.ndarray, positions × tracks), `.metadata` (DataFrame), `.interval`, `.resolution` |
| `VariantOutput` | `.reference` and `.alternate`, each an `Output` |
| Variant scores | `anndata.AnnData`: `.X` scores, `.obs` genes, `.var` tracks, `.uns` variant/interval/scorer, `.layers['quantiles']` when available |

Useful `TrackData` methods: `.resize()`, `.slice_by_interval()`, `.slice_by_positions()`, `.select_tracks_by_name()`, `.select_tracks_by_index()`, `.filter_tracks(mask)`, `.change_resolution()`, `.reverse_complement()`, `.filter_to_positive_strand()` and the other strand filters.

### 5.6 Client methods at a glance

| Method | Use |
|---|---|
| `predict_sequence(s)` | Raw DNA string(s) of a supported length |
| `predict_interval(s)` | Reference genome interval(s) |
| `predict_variant(s)` | REF and ALT tracks for a variant |
| `score_variant(s)` | Scalar ALT-vs-REF effect scores (per gene × track) |
| `score_ism_variants` | All 3 alternatives at every base of a sub-interval |
| `score_interval(s)` | Scalar summaries of an interval (e.g. gene expression level) |
| `output_metadata(organism)` | Track catalogue |

Plural methods take `max_workers` (default 5) and `progress_bar`. Every method accepts `organism=dna_client.Organism.MUS_MUSCULUS` for mouse.

---

## 6. Recipes (code)

All recipes assume this common setup:

```python
from alphagenome import colab_utils
from alphagenome.data import gene_annotation, genome, transcript as transcript_utils
from alphagenome.interpretation import ism
from alphagenome.models import dna_client, variant_scorers
from alphagenome.visualization import plot_components
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

dna_model = dna_client.create(colab_utils.get_api_key())

# GENCODE v46 annotation (hg38), hosted by DeepMind as a feather file
gtf = pd.read_feather(
    'https://storage.googleapis.com/alphagenome/reference/gencode/'
    'hg38/gencode.v46.annotation.gtf.gz.feather'
)
gtf_mane = gene_annotation.filter_to_mane_select_transcript(
    gene_annotation.filter_protein_coding(gtf)
)
tx_mane = transcript_utils.TranscriptExtractor(gtf_mane)   # clean plots
tx_all = transcript_utils.TranscriptExtractor(gtf)          # all isoforms (for splicing)
```

### 6.1 Explore the track catalogue and find ontology terms

```python
meta = dna_model.output_metadata(dna_client.Organism.HOMO_SAPIENS).concatenate()

# How many tracks per output type?
print(meta.groupby('output_type').size())

# Find biosamples matching a keyword
hits = meta[meta['biosample_name'].str.contains('T cell|monocyte|liver',
                                                case=False, na=False)]
print(hits[['output_type', 'ontology_curie', 'biosample_name', 'strand', 'name']]
      .drop_duplicates().head(30))

# Which output types exist for a given CURIE?
curie = 'CL:0000084'  # T cell
print(meta.loc[meta.ontology_curie == curie, 'output_type'].value_counts())

meta.to_csv('alphagenome_human_tracks.csv', index=False)   # keep a local copy
```

> Tip: not every tissue has every assay. Check the counts above before you request, for example, `CHIP_TF` for a tissue that only has RNA-seq.

### 6.2 Predict tracks for a gene locus and plot them

```python
interval = gene_annotation.get_gene_interval(gtf, gene_symbol='CYP2B6')
interval = interval.resize(dna_client.SEQUENCE_LENGTH_1MB)

out = dna_model.predict_interval(
    interval=interval,
    requested_outputs=[dna_client.OutputType.RNA_SEQ,
                       dna_client.OutputType.DNASE,
                       dna_client.OutputType.CHIP_HISTONE],
    ontology_terms=['UBERON:0002107'],                      # liver
)

# Select only H3K27ac among histone tracks
h3k27ac = out.chip_histone.filter_tracks(
    out.chip_histone.metadata['histone_mark'].astype(str).str.upper()
    .eq('H3K27AC').to_numpy()
)

plot_components.plot(
    [
        plot_components.TranscriptAnnotation(tx_mane.extract(interval)),
        plot_components.Tracks(out.rna_seq),
        plot_components.Tracks(out.dnase),
        plot_components.Tracks(h3k27ac),
    ],
    interval=interval.resize(2**16),     # zoom to 64 kb around the centre
)
plt.show()

# Save raw arrays
np.savez_compressed('cyp2b6_liver.npz',
                    rna=out.rna_seq.values, dnase=out.dnase.values)
```

> If the `histone_mark` column name differs in your version, print `out.chip_histone.metadata.columns`.

### 6.3 Predict an arbitrary or edited sequence

Use this for reporter constructs, enhancer variants or designed edits. **Embed your sequence in its real genomic context**: N-padding works, but it is out of distribution and less reliable.

```python
from alphagenome.io import fasta
# Download a GRCh38.p13 FASTA (e.g. GENCODE) and index it: samtools faidx GRCh38.p13.genome.fa
fx = fasta.FastaExtractor('GRCh38.p13.genome.fa')

L = dna_client.SEQUENCE_LENGTH_1MB
ctx = genome.Interval('chr11', 5_200_000, 5_200_001).resize(L)
ref_seq = fx.extract(ctx)

# Replace a 200-bp window at the centre with a designed element
designed = 'ACGT' * 50
mid = L // 2
edited = ref_seq[:mid-100] + designed + ref_seq[mid+100:]
assert len(edited) == L            # keep the length EXACTLY supported

outs = dna_model.predict_sequences(
    [ref_seq, edited],
    requested_outputs=[dna_client.OutputType.DNASE, dna_client.OutputType.CAGE],
    ontology_terms=['EFO:0002067'],   # K562
    intervals=[ctx, ctx],             # optional: lets plots use genome coordinates
)
delta = outs[1].dnase.values - outs[0].dnase.values
print('max |ΔDNase| near edit:', np.abs(delta[mid-1000:mid+1000]).max())
```

For insertions or deletions, trim or extend the flanks so that the total length stays exactly `L`.

### 6.4 Visualise a variant's effect (REF vs ALT tracks)

```python
variant = genome.Variant('chr22', 36201698, 'A', 'C')         # 1-based, hg38
interval = variant.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB)

vo = dna_model.predict_variant(
    interval=interval, variant=variant,
    requested_outputs=[dna_client.OutputType.RNA_SEQ],
    ontology_terms=['UBERON:0001157'],                       # transverse colon
)

plot_components.plot(
    [
        plot_components.TranscriptAnnotation(tx_mane.extract(interval)),
        plot_components.OverlaidTracks(
            tdata={'REF': vo.reference.rna_seq, 'ALT': vo.alternate.rna_seq},
            colors={'REF': 'dimgrey', 'ALT': 'red'},
        ),
    ],
    interval=vo.reference.rna_seq.interval.resize(2**15),
    annotations=[plot_components.VariantAnnotation([variant], alpha=0.8)],
)
plt.show()
```

### 6.5 Score a variant (scalar effect sizes)

```python
scorers = variant_scorers.get_recommended_scorers(
    dna_client.Organism.HOMO_SAPIENS.value
)                                   # every recommended scorer for human
# ...or pick a subset:
# scorers = [variant_scorers.RECOMMENDED_VARIANT_SCORERS[k]
#            for k in ('RNA_SEQ', 'DNASE', 'CHIP_HISTONE', 'SPLICE_SITES')]

scores = dna_model.score_variant(interval=interval, variant=variant,
                                 variant_scorers=scorers)
df = variant_scorers.tidy_scores([scores], match_gene_strand=True)

# Strongest effects (quantile_score is calibrated against background variants)
col = 'quantile_score' if 'quantile_score' in df else 'raw_score'
top = (df.assign(abs_q=df[col].abs())
         .sort_values('abs_q', ascending=False)
         [['output_type', 'gene_name', 'biosample_name', 'track_name',
           'raw_score', col]].head(20))
print(top)
df.to_csv('variant_scores.csv', index=False)
```

**Recommended scorers (what each one computes):**

| Key | Scorer | Spatial mask | Aggregation |
|---|---|---|---|
| `RNA_SEQ` | `GeneMaskLFCScorer` | exons of each gene | log(mean ALT + 1e-3) − log(mean REF + 1e-3) |
| `CAGE`, `PROCAP`, `DNASE`, `ATAC`, `CHIP_TF` | `CenterMaskScorer` | 501 bp around the variant | `DIFF_LOG2_SUM` = log2(ΣALT+1) − log2(ΣREF+1) |
| `CHIP_HISTONE` | `CenterMaskScorer` | 2,001 bp | `DIFF_LOG2_SUM` |
| `SPLICE_SITES`, `SPLICE_SITE_USAGE` | `GeneMaskSplicingScorer` | gene body | max \|ALT − REF\| |
| `SPLICE_JUNCTIONS` | `SpliceJunctionScorer` | top junctions | max \|log-fold change\| |
| `POLYADENYLATION` | `PolyadenylationScorer` | gene 3′ end | PAS usage change |
| `CONTACT_MAPS` | `ContactMapScorer` | 1 Mb | mean \|Δcontact\| |
| `*_ACTIVE` | `CenterMaskScorer`/`GeneMaskActiveScorer` | as above | max(ALT, REF): "is this region active at all?" |

Custom scorer example: a mean-difference DNase score over 1 kb.

```python
custom = variant_scorers.CenterMaskScorer(
    requested_output=dna_client.OutputType.DNASE,
    width=1001,
    aggregation_type=variant_scorers.AggregationType.DIFF_MEAN,
)
```

Available `AggregationType` values: `DIFF_MEAN`, `DIFF_SUM`, `DIFF_SUM_LOG2`, `DIFF_LOG2_SUM`, `L2_DIFF`, `L2_DIFF_LOG1P`, `ACTIVE_MEAN`, `ACTIVE_SUM`.

### 6.6 Splicing analysis

AlphaGenome has three complementary splicing heads:

- **`SPLICE_SITES`**: the probability that each base is a donor or acceptor. Sequence-intrinsic, so there are no tissue tracks.
- **`SPLICE_SITE_USAGE`**: the fraction of transcripts that use each site, per tissue.
- **`SPLICE_JUNCTIONS`**: predicted split-read counts for donor–acceptor pairs, per tissue. This captures exon skipping, cryptic sites and intron retention, and is the basis for sashimi plots and PSI.

#### 6.6.1 Merged splicing score (the method used in the paper)

```
alphagenome_splicing = max|Δ splice_sites| + max|Δ splice_site_usage| + max|Δ splice_junctions| / 5
```

```python
SPLICE_SCORERS = [variant_scorers.RECOMMENDED_VARIANT_SCORERS[k]
                  for k in ('SPLICE_SITES', 'SPLICE_SITE_USAGE', 'SPLICE_JUNCTIONS')]

def merged_splicing(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['variant_id'] = df['variant_id'].map(str)
    m = (df.groupby(['variant_id', 'output_type'])['raw_score'].max()
           .reset_index()
           .pivot(index='variant_id', columns='output_type', values='raw_score')
           .fillna(0.0))
    m['alphagenome_splicing'] = (m.get('SPLICE_SITES', 0.0)
                                 + m.get('SPLICE_SITE_USAGE', 0.0)
                                 + m.get('SPLICE_JUNCTIONS', 0.0) / 5.0)
    return m.reset_index().sort_values('alphagenome_splicing', ascending=False)

v = genome.Variant('chr13', 32316462, 'T', 'G')               # BRCA2, near a splice site
res = dna_model.score_variant(
    interval=v.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB),
    variant=v, variant_scorers=SPLICE_SCORERS)
print(merged_splicing(variant_scorers.tidy_scores([res])))
```

**Interpretation:** the score runs from 0 upwards with no fixed maximum. Most variants fall between 0 and 6, and in practice **> 1.0 generally indicates a large effect**. DeepMind has not yet published an official cutoff. Calibrate against known pathogenic and benign splice variants in your gene.

#### 6.6.2 Sashimi plot (REF vs ALT)

```python
v = genome.Variant('chr22', 36201698, 'A', 'C')
iv = v.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB)
vo = dna_model.predict_variant(
    interval=iv, variant=v,
    requested_outputs=[dna_client.OutputType.SPLICE_JUNCTIONS,
                       dna_client.OutputType.SPLICE_SITE_USAGE],
    ontology_terms=['CL:0000084'],                         # T cell
)

plot_components.plot(
    [
        plot_components.TranscriptAnnotation(tx_all.extract(iv)),   # all isoforms
        plot_components.Sashimi(vo.reference.splice_junctions,
            ylabel_template='REF {biosample_name} ({strand})\n{name}', color='skyblue'),
        plot_components.Sashimi(vo.alternate.splice_junctions,
            ylabel_template='ALT {biosample_name} ({strand})\n{name}', color='red'),
    ],
    annotations=[plot_components.VariantAnnotation([v])],
    interval=iv.resize(40_000),
)
plt.show()
```

The numbers on the arcs are **predicted normalised junction counts, not PSI**.

#### 6.6.3 Derive PSI5 / PSI3 and ΔPSI

```python
def psi_tables(jd, track_idx):
    rows = []
    for i, j in enumerate(jd.junctions):
        donor, acceptor = (j.start, j.end) if j.strand == '+' else (j.end, j.start)
        rows.append({'donor': donor, 'acceptor': acceptor,
                     'count': jd.values[i, track_idx]})
    m = pd.DataFrame(rows).pivot_table(index='donor', columns='acceptor',
                                       values='count', fill_value=0)
    psi5 = m.div(m.sum(axis=1), axis=0).fillna(0)   # donor → which acceptor
    psi3 = m.div(m.sum(axis=0), axis=1).fillna(0)   # acceptor ← which donor
    return psi5, psi3

titles = vo.reference.splice_junctions.metadata['Assay title'].astype(str).str.lower()
polya = int(np.where(titles.str.contains('polya'))[0][0])   # prefer polyA+ (mature mRNA)

psi5_ref, _ = psi_tables(vo.reference.splice_junctions, polya)
psi5_alt, _ = psi_tables(vo.alternate.splice_junctions, polya)
dpsi5 = psi5_alt.sub(psi5_ref, fill_value=0)
print(dpsi5.stack().abs().sort_values(ascending=False).head(10))   # biggest ΔPSI
```

#### 6.6.4 Splicing checklist

1. Use **1 Mb** context.
2. Look at the merged score, then at which component drives it.
3. Use a **relevant tissue** for `SPLICE_SITE_USAGE`/`SPLICE_JUNCTIONS`. Prefer polyA+ tracks.
4. Sashimi: is a canonical junction lost? Did a new one appear (cryptic site, exon skipping)?
5. Reconstruct the aberrant transcript, then check frame/PTC/NMD, then (optionally) AlphaFold (see §2.1).
6. For deep-intronic variants, look for **new** donor/acceptor peaks in `SPLICE_SITES` (pseudo-exon creation).

### 6.7 Batch scoring from a VCF (production-style script)

```python
"""score_vcf.py — usage: python score_vcf.py input.vcf out.csv"""
import sys, time, pandas as pd
from cyvcf2 import VCF                      # pip install cyvcf2
from alphagenome import colab_utils
from alphagenome.data import genome
from alphagenome.models import dna_client, variant_scorers

vcf_path, out_csv = sys.argv[1], sys.argv[2]
model = dna_client.create(colab_utils.get_api_key())
L = dna_client.SEQUENCE_LENGTH_1MB
SCORERS = [variant_scorers.RECOMMENDED_VARIANT_SCORERS[k] for k in
           ('RNA_SEQ', 'DNASE', 'ATAC', 'CHIP_HISTONE', 'CAGE',
            'SPLICE_SITES', 'SPLICE_SITE_USAGE', 'SPLICE_JUNCTIONS')]

variants = []
for rec in VCF(vcf_path):
    for alt in rec.ALT:                                      # split multi-allelic
        chrom = rec.CHROM if rec.CHROM.startswith('chr') else f'chr{rec.CHROM}'
        variants.append(genome.Variant(chrom, rec.POS, rec.REF, alt,
                        name=f'{chrom}_{rec.POS}_{rec.REF}_{alt}'))
print(f'{len(variants)} variants')

CHUNK = 50
frames = []
for i in range(0, len(variants), CHUNK):
    chunk = variants[i:i+CHUNK]
    intervals = [v.reference_interval.resize(L) for v in chunk]
    for attempt in range(3):
        try:
            res = model.score_variants(intervals, chunk, SCORERS, max_workers=5)
            break
        except Exception as e:                               # quota / transient errors
            print('retry', attempt, e); time.sleep(30 * (attempt + 1))
    else:
        continue
    df = variant_scorers.tidy_scores(res, match_gene_strand=True)
    frames.append(df)
    df.to_csv(f'{out_csv}.part{i//CHUNK:04d}.csv', index=False)   # checkpoint

pd.concat(frames).to_csv(out_csv, index=False)
```

Then summarise one row per variant:

```python
df = pd.read_csv('out.csv')
col = 'quantile_score' if 'quantile_score' in df else 'raw_score'
summary = (df.assign(a=df[col].abs())
             .groupby(['variant_id', 'output_type'])['a'].max()
             .unstack())
summary['max_any'] = summary.max(axis=1)
summary.sort_values('max_any', ascending=False).head(25)
```

> Filter early: score only the tissues you care about by filtering `ontology_curie` in the tidy table. If you use custom scorers, request fewer output types.

### 6.8 In silico mutagenesis (ISM) and sequence logos

ISM finds which bases inside a region drive a signal: TF motifs, splice elements, promoter cores.

```python
seq_iv = genome.Interval('chr20', 3_753_000, 3_753_400).resize(dna_client.SEQUENCE_LENGTH_16KB)
ism_iv = seq_iv.resize(256)                       # mutate the central 256 bp → 768 variants

scorer = variant_scorers.CenterMaskScorer(
    requested_output=dna_client.OutputType.DNASE, width=501,
    aggregation_type=variant_scorers.AggregationType.DIFF_MEAN)

vs = dna_model.score_ism_variants(interval=seq_iv, ism_interval=ism_iv,
                                  variant_scorers=[scorer])

def pick(adata, curie='EFO:0002067'):             # K562
    x = adata.X[:, adata.var['ontology_curie'] == curie]
    return x.flatten()[0]

mat = ism.ism_matrix([pick(x[0]) for x in vs],
                     variants=[x[0].uns['variant'] for x in vs])   # (256, 4)

plot_components.plot([plot_components.SeqLogo(scores=mat, scores_interval=ism_iv,
                                              ylabel='ISM K562 DNase')],
                     interval=ism_iv, fig_width=35)
plt.show()
```

Cost scales as 3 × width, so keep ISM windows small (≤ 256–512 bp) and use 16 kb context.

### 6.9 Indels, MNVs and haplotypes

- **Indels:** pass them directly, e.g. `genome.Variant('chr1', 1000, 'ATG', 'A')`. Predictions are aligned back to REF coordinates for scoring.
- **Multiple variants in cis (haplotype / multi-edit):** build one combined `Variant` that spans all of them, with REF = the reference stretch and ALT = the same stretch carrying every change. Compare it with the single variants to detect epistasis.

```python
from alphagenome.io import fasta
fx = fasta.FastaExtractor('GRCh38.p13.genome.fa')

def combine(muts):
    chrom = muts[0].chromosome
    lo, hi = min(m.position for m in muts), max(m.position for m in muts)
    ref = fx.extract(genome.Interval(chrom, lo - 1, hi)).upper()
    alt = list(ref)
    for m in muts:                      # SNVs only in this simple version
        assert ref[m.position - lo] == m.reference_bases.upper(), 'REF mismatch'
        alt[m.position - lo] = m.alternate_bases.upper()
    return genome.Variant(chrom, lo, ref, ''.join(alt))

muts = [genome.Variant('chr5', 1295113, 'G', 'A'), genome.Variant('chr5', 1295135, 'G', 'A')]
hap = combine(muts)                     # TERT promoter double mutant
```

The model is **not diploid-aware**, so a heterozygous state is not modelled. Interpret ALT as homozygous or allele-specific.

### 6.10 3D contact maps

```python
v = genome.Variant('chr7', 27_200_000, 'C', 'T')   # illustrative: replace with your variant (REF must match hg38)
iv = v.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB)
vo = dna_model.predict_variant(interval=iv, variant=v,
        requested_outputs=[dna_client.OutputType.CONTACT_MAPS],
        ontology_terms=None)                              # few tracks (~28) → take all

diff = vo.alternate.contact_maps.values - vo.reference.contact_maps.values
print('max |Δcontact|:', np.abs(diff).max())
plot_components.plot([plot_components.ContactMaps(vo.reference.contact_maps, max_num_tracks=2)],
                     interval=iv)
plt.show()
```

`plot_components.ContactMapsDiff` plots differences on a diverging scale. Contact effects from single SNVs are usually small; they matter most for CTCF-site and boundary variants.

### 6.11 Interval scoring (baseline gene activity)

```python
from alphagenome.models import interval_scorers
iv = gene_annotation.get_gene_interval(gtf, gene_symbol='GATA1').resize(
        dna_client.SEQUENCE_LENGTH_1MB)
res = dna_model.score_interval(
        interval=iv,
        interval_scorers=[interval_scorers.RECOMMENDED_INTERVAL_SCORERS['RNA_SEQ']])
expr = variant_scorers.tidy_scores(res)     # predicted expression per gene × track
```

Use this for "is gene X predicted to be expressed in cell type Y?", or as a denominator to normalise variant effects.

### 6.12 AlphaGenome Atlas (precomputed scores, no GPU or API compute)

The Atlas (released 8 September 2026) holds precomputed effect predictions for **every possible SNV in the human genome (~9 billion)**. Each variant also gets an **AVI (AlphaGenome Variant Impact) score**: a single number that combines regulatory predictions with AlphaMissense for coding changes, with feature attributions (accessibility, splicing, conservation…).

- **Web portal (no code):** https://alphagenome.google/atlas
- **Python (package ≥ 0.9.0):**

```python
from alphagenome import colab_utils
from alphagenome.atlas import atlas
from alphagenome.data import genome

ac = atlas.create(colab_utils.get_api_key())

# 1. Which precomputed scorers exist?
meta = ac.scorer_metadata()
for name, m in meta.items():
    print(name, m)

scorer_names = list(meta)[:3]          # choose by name from the list above

# 2. One variant
res = ac.query_variant(genome.Variant('chr22', 36201698, 'A', 'C'),
                       requested_scorers=scorer_names,
                       ontology_terms=['UBERON:0001157'])

# 3. Many variants, or every SNV in a region (e.g. a promoter / exon)
res_iv = ac.query_interval(genome.Interval('chr22', 36201600, 36201800),
                           requested_scorers=scorer_names,
                           gene_names=['APOL4'])
for scorer, adata in res_iv.items():
    print(scorer, adata.shape)
```

Atlas vs live API: the Atlas is instant and covers **SNVs on hg38 only**. Indels, haplotypes, custom sequences, mouse or custom scorers need the live API.

### 6.13 Mouse

Add `organism=dna_client.Organism.MUS_MUSCULUS` to any call and use **mm10** coordinates. Track sets differ (there is no `PROCAP` in mouse), so check `output_metadata(Organism.MUS_MUSCULUS)`.

### 6.14 Local inference with open weights

```bash
git clone https://github.com/google-deepmind/alphagenome_research.git
pip install -e ./alphagenome_research
# Accept the model terms on Kaggle (google/alphagenome) or Hugging Face first
```

```python
from alphagenome_research.model import dna_model
model = dna_model.create_from_kaggle('all_folds')
# Same interface: model.predict_variant(...), model.score_variant(...), ...
```

Requirements: an NVIDIA **H100-class GPU** with JAX/CUDA for inference (TPU v3+ for training). This makes sense for very large screens, sensitive data, or fine-tuning experiments.

---

## 7. Use-case catalogue

| # | Use case | What to run | Key outputs / scorers | Notes |
|---|---|---|---|---|
| 1 | **Non-coding VUS prioritisation** (rare disease, cancer) | Batch scoring (§6.7) or Atlas lookup (§6.12) | All recommended scorers; AVI | Rank by max \|quantile\| in the relevant tissue |
| 2 | **Splice-variant interpretation** (exonic, canonical ±1/2, deep intronic) | §6.6 merged score + sashimi + PSI | `SPLICE_*` | Combine with SpliceAI/RNA-seq if available |
| 3 | **GWAS / eQTL fine-mapping** | Score all SNPs in a credible set | `RNA_SEQ`, `DNASE`, `CHIP_HISTONE`, `CAGE` | Look for one variant with a consistent multi-modal effect |
| 4 | **Mechanism of a regulatory variant** | `predict_variant` + ISM around the variant | `CHIP_TF`, `DNASE`, ISM logo | Does it create or destroy a TF motif? Which TF? |
| 5 | **Enhancer–gene linking** | `predict_interval` (1 Mb) + contact maps; in-silico deletion of the enhancer | `RNA_SEQ` LFC on candidate genes, `CONTACT_MAPS` | Delete the element via `predict_sequence` on the edited sequence |
| 6 | **Promoter / UTR / polyA variants** | Score with `CAGE`, `PROCAP`, `POLYADENYLATION` | TSS usage, PAS usage | Good for 5′/3′ UTR VUS |
| 7 | **Designing genome edits in silico** (base/prime editing, CRISPR KO of regulatory elements) | Edited-sequence prediction (§6.3) or a multi-variant haplotype (§6.9) | Δ tracks at the target and genome-wide within 1 Mb | Check that intended corrections restore WT-like expression/splicing and that silent/PAM-disrupting edits don't create cryptic splice sites |
| 8 | **Transgene / vector cassette design** | Predict the construct embedded in a genomic context | `SPLICE_SITES` (cryptic sites in the cDNA), `DNASE`, `CAGE` | Out-of-distribution: use for flagging risks, not for quantitative claims |
| 9 | **CRISPR screen / MPRA follow-up** | Score tiled variants; ISM | `DNASE`, `ATAC`, `CAGE` | Compare predicted vs measured activity to pick hits |
| 10 | **Synthetic regulatory element design** | Iterative mutate → predict loop | `DNASE`/`CAGE` in the target cell type | Validate experimentally; designs drift off-distribution |
| 11 | **Cell-type-specific regulation** | Same variant across many `ontology_terms` | Tidy table grouped by `biosample_name` | Shows where a variant acts |
| 12 | **Cross-species (mouse model) checks** | Same analysis with `MUS_MUSCULUS` on the orthologous locus | All | Is the human variant's effect conserved in your mouse model? |
| 13 | **Teaching / hypothesis generation** | Plot tracks for any locus | Everything | Fast "virtual ENCODE" for loci without data |

---

## 8. Interpreting scores — best practices

1. **Prefer `quantile_score`** when it is present. It ranks the effect against a background distribution of common variants, so it is comparable across modalities. `raw_score` is in modality-specific units (log fold change, probability difference…).
2. **Match the biology:** filter to tissues or cell types relevant to your phenotype. A big effect in an irrelevant tissue is weak evidence.
3. **Check strand:** use `match_gene_strand=True` in `tidy_scores` so that a gene isn't scored on the opposite-strand RNA track.
4. **Look at consistency across modalities:** a real enhancer variant often moves DNase/ATAC, H3K27ac, the TF track and target-gene RNA in the same direction.
5. **Always plot the top hits** (REF/ALT overlay or sashimi) before believing a score.
6. **Effect sizes are relative**, not absolute expression levels. Use `*_ACTIVE` scorers or interval scoring to check that the region or gene is active at all.
7. **Use 1 Mb context** for anything gene-level.
8. **Calibrate locally:** score known pathogenic and benign variants in your gene of interest, then set your own thresholds.
9. **ACMG/AMP:** treat AlphaGenome as *computational supporting evidence* (PP3/BP4-type), never as stand-alone proof.
10. **Report** the package version, model version (`ALL_FOLDS`), sequence length, ontology terms and scorers used.

---

## 9. Limitations

- **Not diploid-aware.** It sees one sequence and does not model heterozygosity or allele interactions in trans.
- **Personal genomes and large structural variants** are not benchmarked. Synthetic or heavily edited sequences are out of distribution.
- **Very distal (> ~100 kb) enhancer effects and fine tissue specificity** remain hard. The 1 Mb window helps but is not perfect.
- **Molecular, not phenotypic:** it predicts molecular readouts, not disease, penetrance or complex traits.
- **Species:** human and mouse only. Quality on other species is untested.
- **Training-data bias:** it is limited to the cell types and assays in ENCODE, GTEx, FANTOM5, 4DN and similar. Rare cell states may be missing.
- **Licence:** the API and weights are **non-commercial**. Commercial work must go through Google Cloud.

---

## 10. Troubleshooting and quotas

| Symptom | Likely cause | Fix |
|---|---|---|
| `ValueError` on sequence length | Length is not 16,384 / 131,072 / 524,288 / 1,048,576 | `interval.resize(dna_client.SEQUENCE_LENGTH_1MB)` |
| Scores look like noise / REF mismatch | hg19 coordinates, or 0- vs 1-based confusion | LiftOver to hg38; Variant = 1-based, Interval = 0-based |
| Empty output for a tissue | No tracks of that assay for that CURIE | Check `output_metadata` (§6.1) |
| Gene missing from RNA scores | Gene is outside the interval, or a strand mismatch | Use 1 Mb; check `match_gene_strand` |
| `RESOURCE_EXHAUSTED` / timeouts | Rate limits under high demand | Lower `max_workers`, chunk, back off and retry (§6.7), run overnight |
| Very slow responses | Requesting all tracks × all outputs at 1 Mb | Request fewer `requested_outputs`; set `ontology_terms` |
| Memory blow-up | Saving full 1 Mb × 600+ tracks for many variants | Save scores (tidy CSV), not raw tracks; or `.slice_by_interval()` first |
| > 1M predictions needed | Beyond the API's intended scale | Use the Atlas for SNVs, or local weights |

The client already retries transient RPC errors. Wrap long jobs with checkpointing anyway.

---

## 11. Resources and citation

**Official**

- Documentation: https://www.alphagenomedocs.com
- API client: https://github.com/google-deepmind/alphagenome (Apache 2.0) · PyPI `alphagenome`
- Research code + weights: https://github.com/google-deepmind/alphagenome_research · Kaggle `google/alphagenome` · Hugging Face `google/alphagenome`
- API key: https://deepmind.google.com/science/alphagenome
- Atlas portal: https://alphagenome.google/atlas · announcement: https://blog.google/innovation-and-ai/models-and-research/google-deepmind/alphagenome-atlas/
- Community forum: https://www.alphagenomecommunity.com
- Tutorials (Colab): quick start, visualisation tour, variant scoring UI, ontology mapping, batch scoring, TAL1 locus workflow, splicing scoring, PSI derivation, haplotypes

**Related tools**

- AlphaFold Server (AF3): https://alphafoldserver.com · AlphaFold DB: https://alphafold.ebi.ac.uk
- AlphaMissense: https://github.com/google-deepmind/alphamissense
- EBI Ontology Lookup Service: https://www.ebi.ac.uk/ols4 · UCSC LiftOver: https://genome.ucsc.edu/cgi-bin/hgLiftOver

**Cite**

> Avsec Ž. et al. *Advancing regulatory variant effect prediction with AlphaGenome.* **Nature** 649, 1206–1218 (2026). doi:10.1038/s41586-025-10014-0

The AlphaGenome Atlas has its own preprint (medRxiv, September 2026). Cite it when you use Atlas/AVI scores.
