# Start here — for biologists new to bioinformatics

## S1. AlphaGenome in plain language

**The one-sentence version.** You give AlphaGenome a stretch of DNA (up to one million letters). It predicts what lab experiments would measure along that DNA: is the gene switched on, is the DNA open, which proteins sit on it, how the RNA gets spliced. Then you change one letter and ask: **what changed?**

### The mental model in four steps

1. **Pick a place in the genome.** For example a variant from a patient, a GWAS hit or a spot you plan to edit.
2. **Describe the change.** The original letter(s) are called **REF** (reference) and the new letter(s) are called **ALT** (alternative).
3. **AlphaGenome predicts "tracks" for both versions.** A *track* is a line graph along the genome, like the coverage plot you would get from RNA-seq, ATAC-seq or ChIP-seq. There are thousands of tracks, one per assay and cell type.
4. **Compare ALT with REF.** If the ALT line is higher, the change is predicted to *increase* that signal (more RNA, more open chromatin, more histone mark…). If it is lower, the change is predicted to *decrease* it. The effect score is simply ALT − REF.

### Why this is useful at the bench

According to the AlphaGenome paper, more than 98% of the genetic variation observed in humans lies outside protein-coding regions, and these non-coding variants can act in many ways: changing chromatin accessibility, histone marks, 3D genome contacts, expression levels or splicing, often only in some cell types. Testing all of that experimentally is not feasible, so predictions help you decide **which variants and which experiments are worth your time**. The paper's discussion describes AlphaGenome as an engine for *in silico experimentation*: rapid hypothesis generation and prioritisation of resource-intensive wet-lab experiments.

> **Note:** AlphaGenome gives you **hypotheses**, not results. A prediction tells you what to test, and the experiment tells you what is true.

### What it does not do

- It does **not** predict protein structure or protein function (see §2 for AlphaFold and AlphaMissense).
- It does **not** predict disease, penetrance or complex traits. It predicts *molecular* readouts.
- It is **not a clinical diagnostic tool** and is not diploid-aware (it does not model heterozygous combinations).

### Numbers worth knowing

| Fact | Value | Source |
|---|---|---|
| DNA it reads in one go | up to 1 Mb | §1, paper |
| Predicted tracks (human / mouse) | 5,930 / 1,128, across 11 modalities | paper |
| Species | human (hg38) and mouse (mm10) | §1 |
| Why 1 Mb? | 99% (465 of 471) of validated enhancer–gene pairs lie within 1 Mb | paper |
| Speed | the final model needs less than 1 s per variant on an NVIDIA H100 GPU | paper |

*Source for "paper": Avsec et al., Nature 2026, [doi:10.1038/s41586-025-10014-0](https://doi.org/10.1038/s41586-025-10014-0).*

## S2. Which route fits me?

You do **not** need to be a programmer to start. Pick the row that matches what you want to do.

| I want to… | Use | Do I need code? | Where to go |
|---|---|---|---|
| Look up one single-nucleotide variant (SNV) quickly | **AlphaGenome Atlas** web portal (precomputed scores) | No | [alphagenome.google/atlas](https://alphagenome.google/atlas), §6.12 |
| Score a few variants or plot tracks, and I can copy and paste | **Snippet builder + Google Colab** | Copy and paste only | G1, G2, [Snippet builder](snippet-builder.html) |
| Score a list of variants (a VCF file) | Batch script from the guide | Run one script (ask a colleague the first time) | G6, §6.7 |
| Study insertions, deletions, designed edits, haplotypes, mouse or my own sequence | Live API | Yes, a little Python | §6.3, §6.9, §6.13 |
| Run more than about 1 million predictions, or keep data private | Local weights on a GPU | Yes, plus a GPU | §6.14, §3 |
| Do commercial work | Google Cloud | Yes | §3 |

> **Warning:** the API and weights are **non-commercial**. Commercial work must go through Google Cloud (§3, §9).

### Before you start: checklist

- [ ] A **Google account** (for Colab, the free notebook service used in the guide).
- [ ] An **API key** from DeepMind (§4.1). Keep it private: never paste it into a notebook you share.
- [ ] Your variant in **hg38** coordinates, with a **1-based** position (like a VCF). If your coordinates are hg19, convert them with UCSC LiftOver first (§5.1).
- [ ] The **tissue or cell type** you care about (§5.3). This matters a lot for the interpretation.

### When to ask a bioinformatician

- Your variants are in hg19, or you are not sure which genome build you have.
- You need to process hundreds of variants or more (G6).
- You plan to put AlphaGenome scores into a paper, a patient report or a grant. Ask for a second pair of eyes on thresholds and controls (§8).

## S3. Glossary

| Term | Plain-language meaning |
|---|---|
| **Variant** | A difference in the DNA letters compared with the reference genome. |
| **REF / ALT** | The reference letter(s) and the alternative letter(s) at the variant position. |
| **SNV** | Single-nucleotide variant: one letter changed (A→C). |
| **Indel** | An insertion or deletion of one or more letters. |
| **Non-coding** | DNA that does not directly code for protein, such as promoters, enhancers, introns and UTRs. |
| **Promoter / TSS** | The region where transcription of a gene starts; TSS is the transcription start site. |
| **Enhancer** | A DNA element that boosts the expression of a gene, sometimes far away from it. |
| **Track** | A line graph along the genome for one assay and cell type (RNA-seq coverage, DNase signal…). |
| **Output type** | The family of tracks, for example `RNA_SEQ`, `DNASE`, `CHIP_HISTONE` (§1.1). |
| **Resolution** | How many bases one value of a track covers (1 bp, 128 bp…). |
| **hg38 / mm10** | The human and mouse reference genome versions AlphaGenome uses. |
| **0-based vs 1-based** | Two ways of counting positions. Variants are 1-based (like VCF); intervals are 0-based (like BED). See §5.1. |
| **VCF** | A tab-separated text file listing variants (chromosome, position, REF, ALT…). |
| **Ontology term (CURIE)** | A standard ID for a tissue or cell type, such as `UBERON:0002107` (liver) or `CL:0000084` (T cell). |
| **Histone marks** | Chemical tags on histones. H3K27ac and H3K4me1 typically mark active enhancers; H3K9me3 and H3K27me3 are repressive; H3K36me3 marks actively transcribed gene bodies. |
| **Chromatin accessibility** | How open the DNA is (measured by DNase-seq or ATAC-seq). Open DNA is where regulators can bind. |
| **TF binding (ChIP-seq)** | Where a transcription factor sits on the DNA. |
| **Splice donor / acceptor** | The two ends of an intron, where the cell cuts and joins the RNA. |
| **Exon skipping** | An exon is left out of the mature RNA. |
| **Cryptic splice site** | A site that is normally unused but becomes used, for example after a variant. |
| **Splice junction** | A connection between a donor and an acceptor, seen as a split read in RNA-seq. |
| **PSI** | Percent spliced in: the fraction of transcripts that use a given exon or site. |
| **Sashimi plot** | A plot of RNA-seq coverage with arcs for splice junctions. |
| **PTC / NMD** | A premature stop codon can trigger nonsense-mediated decay, a cell mechanism that destroys the RNA. |
| **eQTL / sQTL / caQTL** | A variant statistically associated with expression, splicing or chromatin accessibility in a population. |
| **GWAS / credible set** | A genome-wide association study; a credible set is the small group of variants that probably contains the causal one. |
| **ISM** | In silico mutagenesis: change every base of a small region one by one and predict the effect of each (§6.8). |
| **Motif** | A short DNA pattern recognised by a protein, for example a transcription factor. |
| **Raw score** | The effect size in the units of the modality (log fold change, probability difference…). |
| **Quantile score** | The effect ranked against a background of common variants, so it is comparable across modalities (§8). |
| **MPRA** | Massively parallel reporter assay: measures the regulatory activity of many short DNA sequences. |
| **ClinVar** | A public database of variants with clinical interpretations. |
| **PP3 / BP4** | ACMG/AMP evidence codes for computational evidence for or against pathogenicity (§8). |

## S4. How to read the results

### Track plots (REF vs ALT)

In the plot from §6.4, the **grey line is REF** and the **red line is ALT**. Read it like this:

1. Find the **variant marker**. Changes near the marker are most direct.
2. Is red **above** grey? Then the variant is predicted to increase the signal. Is red **below**? Then it is predicted to decrease it.
3. Check the **gene annotation** on top: does the change fall on exons, near the TSS, in an intron?
4. Always check **which tissue and which assay** the track represents. A change in an unrelated tissue is weak evidence (§8.2).

### Sashimi plots (splicing)

The arcs are **predicted junction counts**. The numbers on the arcs are normalised counts, **not PSI** (§6.6.2). What to look for:

- A **canonical arc disappears** in ALT: a normal junction is lost.
- A **new arc appears** in ALT: a new junction, which suggests a cryptic site, exon skipping or a pseudo-exon.

### The score table

The tidy table from §6.5 has one row per **gene × track**, so it can be very long. The columns you will use most:

| Column | What it tells you |
|---|---|
| `output_type` | Which assay family (`RNA_SEQ`, `DNASE`, …). |
| `gene_name` | The gene the score refers to (for expression and splicing scorers). |
| `biosample_name` | The tissue or cell type. |
| `track_name` | The specific track. |
| `raw_score` | Effect size in assay-specific units. **Negative = ALT lowers the signal, positive = ALT raises it.** |
| `quantile_score` | The effect ranked against common variants. Prefer it when present (§8.1). |

**A real example from the paper.** The variant rs9610445 (`chr22:36201698 A>C`) is a known eQTL and sQTL. In GTEx data the ALT allele C is associated with *lower* expression of the gene. AlphaGenome predicted the same direction, with a variant score of **−1.52** and a quantile score of **−1.00**. A negative number here means "ALT lowers expression".

**How to work with the CSV in Excel or Google Sheets:** open `variant_scores.csv`, switch on filters, keep only the tissue you care about (`biosample_name`), then sort by the absolute value of `quantile_score`. The biggest effects are at the top; then check whether the *other* assays agree (§8.4).

### The merged splicing score

For splicing, the guide combines three scores into one number (§6.6.1). It starts at 0 and has no fixed maximum. Most variants fall between 0 and 6, and in practice **above 1.0 generally indicates a large effect**. DeepMind has not published an official cutoff, so calibrate against known pathogenic and benign variants in your gene.

### Agreement between assays is your best friend

A real regulatory variant often moves several things in the same direction: accessibility, H3K27ac, a TF track and the RNA of the target gene (§8.4). A strong score in only one assay and one unrelated tissue deserves suspicion.

## S5. How far can I trust it?

### What the paper reports

| Task | Result reported in the paper |
|---|---|
| Benchmarks overall | Matched or outperformed external models in 25 of 26 variant-effect evaluations and outperformed them in 22 of 24 track-prediction evaluations |
| eQTL direction of effect | Mean sign auROC 0.75 → 0.80 vs. Borzoi; Spearman 0.39 → 0.49 |
| Recovering GTEx eQTLs | At a score threshold giving 90% sign accuracy: 41% of eQTLs recovered vs. 19% for Borzoi |
| GWAS credible sets (18,537) | With a threshold calibrated to 80% accuracy on eQTLs, a confident direction for at least one variant in 49% of credible sets (11% with a conservative PIP-weighted approach); largely complementary to co-localisation (COLOC) |
| Splicing, ClinVar | auPRC 0.66 (deep intronic and synonymous), 0.57 (splice region), 0.18 (missense) |
| Splicing, minigene assay (MFASS) | auPRC 0.51; Pangolin was better at 0.54 |
| Trait-altering variants | A high score threshold strongly enriches for causal candidates, but **recall is low**, particularly for GWAS variants |

### Known limits (paper and guide)

- Very **distal enhancers (more than about 100 kb away)** are still hard, and both AlphaGenome and Borzoi underestimate their effect.
- **Tissue- and cell-type-specific** patterns, and condition-specific effects, are only partly captured. Overall expression levels are predicted well, but cell-type-specific differences are harder. Intermediate splicing efficiencies are also hard.
- Training and evaluation focus on **protein-coding genes**; non-coding genes such as microRNAs are less well covered.
- **Human and mouse only.** Personal genomes and large structural variants are not benchmarked.
- The model gives **no uncertainty estimate** for a prediction.
- It predicts **molecular effects**, not phenotypes (§9).

### Using it in a report

- Treat AlphaGenome as **computational supporting evidence** (PP3/BP4-type), never as stand-alone proof (§8.9).
- **Report** the package version, model version (`ALL_FOLDS`), sequence length, ontology terms and scorers (§8.10).
- **Calibrate locally:** score known pathogenic and benign variants in your gene of interest first (§8.8).
- **Always plot** your top hits before believing a score (§8.5).
