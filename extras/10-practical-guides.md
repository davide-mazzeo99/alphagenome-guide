# G0. How to use these guides

Each guide starts from a real question and ends with something you can do at the bench. The examples come from the AlphaGenome paper (Avsec et al., Nature 2026, [doi:10.1038/s41586-025-10014-0](https://doi.org/10.1038/s41586-025-10014-0)) and from the recipes in §6. Code is copied from the guide; only the variant or the tissue changes.

> **Tip:** run a **known example first** (a positive control). If your setup reproduces the direction of effect reported in the paper, you can trust that your coordinates, tissue and code are set up correctly before moving to your own variants.

> **Note:** the paper's figures come from the model and tracks used by the authors. Your numbers can differ slightly (different tissue track or model version). What should match is the **direction** and the overall pattern.

## G1. Your first prediction in Google Colab (no installation)

**Goal:** confirm that your API key works and that you can get a prediction back. **Level:** copy and paste.

1. **Get an API key** at [deepmind.google.com/science/alphagenome](https://deepmind.google.com/science/alphagenome) (you have to accept the non-commercial terms). See §4.1.
2. **Open a new notebook in Google Colab.**
3. **Store the key as a secret** (§4.3): click the 🔑 **Secrets** icon in the left panel, add a secret named exactly `ALPHA_GENOME_API_KEY`, paste your key, and switch on notebook access.
4. **Install the package.** In the first cell, run:

```python
!pip install alphagenome
```

5. **Run the smoke test** in a second cell (this is the code from §4.4):

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

**What success looks like:** a shape such as `(16384, n_tracks)` is printed. That means one row per DNA position (16,384) and one column per track.

| If you see… | It probably means… |
|---|---|
| The key is not found | The secret name is not exactly `ALPHA_GENOME_API_KEY`, or notebook access is switched off (§4.1, §4.3). |
| A `ValueError` about length | The sequence length is not one of the supported ones (§5.2, §10). |
| `RESOURCE_EXHAUSTED` or timeouts | Rate limits under high demand: retry later (§10). |

> **Warning:** never paste your key into a notebook cell and never share a notebook that contains it (§4.1).

## G2. Score one variant and read the table (worked example: rs9610445)

**Goal:** get an effect score for one variant and understand it. **Level:** copy and paste.

**The example.** rs9610445 (`chr22:36201698 A>C`) is a known eQTL and sQTL. In GTEx, the ALT allele **C** is associated with **lower** expression of the gene. The paper reports that AlphaGenome recovers the direction (variant score −1.52, quantile score −1.00) and that in silico mutagenesis suggests the variant disrupts a splice donor motif.

1. Open the [Snippet builder](snippet-builder.html) and click the example **"rs9610445 (eQTL / sQTL, paper)"**. It fills in the form: `chr22`, position `36201698`, REF `A`, ALT `C`, 1 MB of context, tissue `UBERON:0001157` (transverse colon, the tissue used in §6.4) and the scorers `RNA_SEQ`, `DNASE` and `CHIP_HISTONE`.
2. Click **Copy code**.
3. In Colab (after G1), paste the code in a new cell and run it. The first lines create the client, define the variant, resize the interval to 1 Mb, and call `score_variant`.
4. The last line saves `variant_scores.csv`. Download it from the Colab files panel.
5. Open the CSV in Excel or Google Sheets, filter `output_type` = `RNA_SEQ`, and sort by the absolute value of `quantile_score` (S4).
6. **Check the direction:** a negative score for the gene means ALT lowers expression, which is what the paper reports.

**Look at the tracks too (§6.4).** Run the common setup cell from §6 first, then this code (copied from §6.4):

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

**Next step:** to see *why* (which bases matter), go to G5.

> **Tip:** use your own tissue. The score is only meaningful in a tissue where the gene is expressed. Find the right `ontology_curie` with §6.1.

## G3. Is my variant splice-disrupting?

**Goal:** decide whether a variant changes splicing, and how. **Level:** copy and paste, a little reading.

**Why three views?** The paper models splicing at three levels: *splice sites* (is this base a donor or acceptor?), *splice site usage* (how often is each site used?) and *splice junctions* (which donor pairs with which acceptor?). The guide's merged score combines all three (§6.6.1).

**Examples from the paper** (variants seen in real GTEx RNA-seq data):

| Variant | What was observed | What AlphaGenome predicted |
|---|---|---|
| `chr3:197081044 TACTC>T` (4-bp deletion) | Exon skipping in tibial artery | Lower usage of the exon's splice site, loss of the junctions linking the exon edges, a new junction bypassing the exon, and a strong drop in predicted RNA-seq coverage of the exon |
| `chr21:46126238 G>C` | A new splice junction and an extended exon | The new junction and the extended exon |

**Steps**

1. **Check your coordinates.** Position is 1-based, genome is hg38, and REF must match the genome at that position (§5.1). For a deletion such as `TACTC>T`, REF is the full reference stretch.
2. **Compute the merged score.** Use the code of §6.6.1 (define `SPLICE_SCORERS` and `merged_splicing` once as shown there), then change only the variant line:

```python
v = genome.Variant('chr3', 197081044, 'TACTC', 'T')       # 4-bp deletion from the paper
res = dna_model.score_variant(
    interval=v.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB),
    variant=v, variant_scorers=SPLICE_SCORERS)
print(merged_splicing(variant_scorers.tidy_scores([res])))
```

3. **Read the number** (S4): above 1.0 generally indicates a large effect; there is no official cutoff, so compare with known variants in your gene.
4. **Look at the components.** The table shows which part drives the score: sites, usage or junctions.
5. **Plot the junctions (§6.6.2).** Replace the first line of the sashimi recipe with your variant and choose a relevant tissue (`ontology_terms`). Prefer polyA+ tracks.
6. **Interpret the picture:**

| What you see in ALT vs REF | What it suggests |
|---|---|
| A canonical arc disappears | A normal junction is lost |
| A new arc bridges over an exon | Exon skipping |
| A new arc with a new splice site peak | A cryptic site is used or an exon is extended |
| New donor/acceptor peaks deep in an intron (`SPLICE_SITES`) | Possible pseudo-exon creation (§6.6.4) |

7. **Follow the transcript.** Reconstruct the likely aberrant RNA, check whether the reading frame is kept, whether there is a premature stop codon, and whether it would trigger NMD (§2.1).

**Caveats from the paper**

- Splicing is where AlphaGenome is strongest: it achieved state-of-the-art on six of seven splicing benchmarks. But on a minigene reporter assay (MFASS), Pangolin did slightly better.
- The model has difficulty with *intermediate* splicing efficiencies and tissue-specific nuances.
- For a diagnosis-style question, combine it with other tools and with RNA data if you have them (§7, use case 2).

**Try the BRCA2 example from the guide:** in the Snippet builder, load **"BRCA2 near a splice site (§6.6.1)"**.

## G4. Screen a locus like the paper's TAL1 example

**Goal:** understand a variant that acts through several mechanisms at once. **Level:** a little Python.

**The story.** In T cell acute lymphoblastic leukaemia (T-ALL), several different non-coding mutations around the *TAL1* oncogene all converge on the same result: *TAL1* becomes over-expressed. They include a cluster of 5′ "neo-enhancer" mutations, an intronic SNV and a 3′ neo-enhancer. The paper uses AlphaGenome to "virtually screen" the locus. For the variant `chr1:47239296 C>ACG` it predicted:

- **more** H3K27ac and H3K4me1 (activating marks) at the variant, consistent with a new enhancer forming at that position;
- **less** H3K9me3 and H3K27me3 (repressive marks) near the *TAL1* TSS;
- **more** H3K36me3 (an active transcription mark) across the gene body;
- a **higher** *TAL1* mRNA level.

**Steps**

1. **Choose the right cell type.** The authors used CD34⁺ common myeloid progenitor (CMP) data, "the closest available match to the T-ALL cell of origin". Lesson: pick the tissue or cell type that best matches *your* disease, not just any track. Find it in the metadata with the code of §6.1, changing the keyword:

```python
meta = dna_model.output_metadata(dna_client.Organism.HOMO_SAPIENS).concatenate()
hits = meta[meta['biosample_name'].str.contains('progenitor|CMP', case=False, na=False)]
print(hits[['output_type', 'ontology_curie', 'biosample_name', 'strand', 'name']]
      .drop_duplicates().head(30))
```

2. **Predict REF vs ALT in several modalities** (adapting §6.4). Put the CURIE you found in step 1 where indicated:

```python
variant = genome.Variant('chr1', 47239296, 'C', 'ACG')       # from the paper
interval = variant.reference_interval.resize(dna_client.SEQUENCE_LENGTH_1MB)

vo = dna_model.predict_variant(
    interval=interval, variant=variant,
    requested_outputs=[dna_client.OutputType.RNA_SEQ,
                       dna_client.OutputType.CHIP_HISTONE,
                       dna_client.OutputType.DNASE],
    ontology_terms=['<CURIE from step 1>'],
)
```

3. **Plot and compare** RNA-seq, accessibility and histone tracks (§6.2 shows how to select a single mark such as H3K27ac from the histone tracks; §6.4 shows the REF/ALT overlay).
4. **Use controls.** The paper compared each oncogenic variant with a background of length-matched, sequence-shuffled variants (for the single intronic SNV, with the other possible SNVs at that site). A prediction only means something when it stands out from that background. You can do the same with a few random variants of the same type scored with the same code.
5. **Look for the mechanism** with in silico mutagenesis (G5). In the paper, the ALT sequence created a **MYB** binding motif at the variant, which raised predicted expression, accessibility and H3K27ac, and the model also flagged a nearby ETS-like motif.

> **Note:** the paper reports that these differences are tissue-specific: oncogenic variants stood out most in T-ALL-relevant tracks (for example thymus, CMP, haematopoietic multipotent progenitors).

**Shortcut:** in the Snippet builder, load **"TAL1 neo-enhancer (paper)"**; it prepares the scoring code for this variant.

## G5. Find the mechanism with in silico mutagenesis (ISM)

**Goal:** find which bases inside a region drive a signal. **Level:** a little Python.

**Idea.** ISM changes every base of a small window, one by one, and records the effect of each change. The result is a **sequence logo**: tall letters mark the bases the model considers important. The paper uses it to reveal motifs, for example a splice donor motif disrupted by rs9610445, a MYB motif created in the *TAL1* example, NF-κB-like motifs at accessibility QTLs, SPI1 motifs, and the canonical polyadenylation motif.

**The code (§6.8).** Run the common setup from §6, then this recipe:

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

**What to edit for your own question**

| Line | Change it to… |
|---|---|
| `seq_iv` | Your region of interest (0-based, half-open interval). It is resized to 16 kb of context. |
| `ism_iv` | The window to mutate (centre of `seq_iv`). Keep it small. |
| `requested_output` | The assay you care about, e.g. `RNA_SEQ` or `CHIP_HISTONE`. |
| `curie` in `pick` | Your cell type or tissue (§5.3). |

**Cost:** the number of predictions is 3 × the window width, so keep windows at 256–512 bp and use 16 kb of context (§6.8).

**How to read the logo:** look for short stretches of tall letters. If a stretch matches a known transcription factor motif (for example from a motif database), that factor is a candidate regulator, and a variant that creates or destroys that stretch is a candidate mechanism. Treat it as a hypothesis for a reporter or CRISPR experiment.

## G6. From a variant list to a ranked shortlist

**Goal:** score many variants (for example a credible set or a list of VUS) and pick the ones worth following up. **Level:** run a script (ask a colleague the first time).

1. **Prepare a VCF.** A VCF is a tab-separated text file. A minimal example with three variants from this guide (the columns must be separated by tabs):

```text
##fileformat=VCFv4.2
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
chr22	36201698	rs9610445	A	C	.	.	.
chr3	197081044	.	TACTC	T	.	.	.
chr21	46126238	.	G	C	.	.	.
```

2. **Check the build and the REF letters.** hg38 only, 1-based positions (§5.1). Using hg19 coordinates is the most common source of noise.
3. **Run the batch script of §6.7** (`score_vcf.py`) exactly as written:

```bash
python score_vcf.py input.vcf out.csv
```

Start with the three-variant file above. When it works, run your full list. The script splits multi-allelic sites, processes variants in chunks, retries on transient errors and saves checkpoint files.

4. **Summarise one row per variant** with the code at the end of §6.7:

```python
df = pd.read_csv('out.csv')
col = 'quantile_score' if 'quantile_score' in df else 'raw_score'
summary = (df.assign(a=df[col].abs())
             .groupby(['variant_id', 'output_type'])['a'].max()
             .unstack())
summary['max_any'] = summary.max(axis=1)
summary.sort_values('max_any', ascending=False).head(25)
```

5. **Filter to your tissue.** Keep only rows with the `ontology_curie` of the cell types you care about before ranking (§6.7, §8.2).
6. **Plot the top hits** (G2 and G3) and check agreement across assays (§8.4).

**Practical tips**

- **Be gentle with the API.** If you see `RESOURCE_EXHAUSTED` or timeouts, lower `max_workers`, use chunks, back off and retry, or run overnight (§10). The API is meant for thousands of predictions, not more than about a million.
- **Save scores, not raw tracks.** Raw 1 Mb tracks for many variants blow up memory (§10).
- **For SNVs genome-wide**, the Atlas has precomputed scores (§6.12).

**GWAS context from the paper.** For 18,537 GWAS credible sets, the authors used a score threshold calibrated to 80% sign accuracy on eQTLs and obtained a confident direction of effect for at least one variant in 49% of credible sets. The sets resolved were largely different from those resolved by co-localisation (COLOC), so the two approaches are complementary. They also note that a high threshold enriches causal candidates but has low recall for GWAS variants. In practice: **a high score is a good reason to prioritise a variant; a low score is not proof that a variant is irrelevant.**

## G7. Planning wet-lab follow-up

**Goal:** turn predictions into a short, defensible list of experiments. **Level:** reading and planning.

| Wet-lab goal | What to run | What to check | Caveat |
|---|---|---|---|
| Choose which variants to test in cells | G6 on the full list, then plots of the top hits | Direction and agreement across assays in the *right* tissue | A high score is a prioritisation, not a verdict |
| Test an enhancer or a regulatory SNV | G2 and G5 (ISM) | Does the change create or destroy a motif? Is the target gene's RNA predicted to move? | Effects of very distal enhancers (> ~100 kb) are underestimated |
| Design a genome edit (base, prime, CRISPR) | Edited sequence (§6.3) or a multi-variant haplotype (§6.9) | Does the correction restore WT-like expression and splicing? Do silent or PAM-disrupting edits create cryptic splice sites? | Edited sequences are out of distribution; check the effect on neighbouring genes |
| Check a transgene or vector cassette | Predict the construct inside a genomic context (§6.3) | Cryptic splice sites in the cDNA (`SPLICE_SITES`), accessibility, TSS activity | Use for flagging risks, not for quantitative claims |
| Follow up a CRISPR screen or MPRA | Score the tiled variants and run ISM | Predicted vs measured activity | Calibrate on your own data |
| Design a splice-modulating oligo or a tissue-specific enhancer | Splicing analysis (G3), iterative mutate → predict loops | The effect in the *target* tissue and in tissues where you do not want it | The paper discusses these uses as promising; validate every design experimentally |

> **Warning:** designs that you optimise against the model can drift off the data the model knows. Always validate experimentally (§7, use cases 7–10).

### Before you order anything: checklist

- [ ] I ran a **known example** (G2 or G3) and got the expected direction.
- [ ] My variants are **hg38**, 1-based, and **REF matches** the reference genome (§5.1).
- [ ] I used the **tissue or cell type that matches my biology** (G4).
- [ ] I looked at the **plots** of my top hits, not only at the scores (§8.5).
- [ ] At least **two assays agree** (for example accessibility and expression) (§8.4).
- [ ] I have a **control**: a variant I expect to have no effect, or a shuffled or neighbouring variant (G4).
- [ ] I **recorded** the package version, model version, sequence length, ontology terms and scorers (§8.10).
- [ ] I describe the result as **computational evidence that supports a hypothesis**, not as proof (S5).
