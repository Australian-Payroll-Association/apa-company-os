# APA Pricing Configs — Full Per-Service Extraction

Source: extracted OOXML of the consultant pricing workbook (`sheetN.xml`). Every figure
below is lifted **directly from the cells** — no numbers invented. Cell citations use the
worksheet's own row/column (Member $ = col **G**, Non-Member $ = col **I** except where a
Tech-Costs column shifts Non-Member to **J/K** — noted per tab). Read alongside
`pricing-model-analysis.md` (the engine narrative and vocabulary). The three services fully
documented there (Payroll 360, PayReview, Award Interpretation) are **verified against the
cells here** and any corrections are flagged.

**Global constants (unchanged):** Member day rate **$2,400/day**, Non-Member **$2,600/day**.
No GST anywhere. Only built-in discount is **NFP −15%**. Rate tables sit below each input
block; the `/2000` divisor appears only in helper/"days" display columns, never the price path.

---

## Coverage table

| Sheet | Service | Type | Status | Missing / notes |
|---|---|---|---|---|
| 5 | Payroll 360 | Calculator | COMPLETE (verified vs cells) | Min $25k documented but **not** enforced in Total (SUM, no MAX) |
| 6 | Compliance Review | Calculator | COMPLETE | No min fee |
| 7 | Optimisation Review | Calculator | COMPLETE | **Not day-rate** — scope-sum × headcount multiplier |
| 8 | PayCompliance | Calculator | COMPLETE | Min $15,000 (MAX enforced) |
| 9 | Health Check | Calculator | COMPLETE | Min $25,000 (MAX enforced) |
| 10 | PayReview | Calculator | COMPLETE (verified) | Min $12,500 (MAX). **Correction:** Knowledge-gap +10%, Data-quality +10% (ref said 15%) |
| 11 | BOOT Evaluation | Calculator | COMPLETE | **Not day-rate** — remediation-style w/ Tech Costs + WageSafe |
| 12 | Technology Procurement | Calculator | COMPLETE | **Not day-rate** — banded task counts + % stack |
| 13 | Remediation | Calculator | COMPLETE | Recalc multiplier + separate WageSafe Tech Costs; back-pay 20%/type |
| 14 | System Implementation Support | Calculator | COMPLETE | **Not day-rate** — award/EBA as effort multipliers |
| 15 | STP2 Review | Calculator | COMPLETE | **Not day-rate** — pay-code band + % toggles |
| 16 | Award Interpretation | Calculator (fixed card) | COMPLETE (verified) | Complexity 1–4 → fixed fee |
| 17 | Super Review | Calculator | COMPLETE | Base bands + recalc multiplier + data-quality |
| 18 | LSL Review | Calculator | COMPLETE | Identical engine to Super (sheet 17) |
| 25 | Tech | Deal log | NOT-A-CALCULATOR | Worked-example log (Tech Procurement deals) |
| 29 | Leave | Deal log | NOT-A-CALCULATOR | Worked-example log (leave-accrual remediation deals) |
| 30 | Super Rem | Deal log | NOT-A-CALCULATOR | Worked-example log (super remediation deals) |
| 32 | SysImp | Deal log | NOT-A-CALCULATOR | Worked-example log (implementation-support deals) |

**Day-rate finding:** The workbook has **no pure "days × rate" service**. Every calculator
builds price from banded/flat/unit components; the $2,400/$2,600 rate only ever converts a
pre-set effort (hours/days) constant in the rate table into the dollar figure that then feeds
the bands and add-ons. So there is no "enter N days" service. Day counts that DO appear are the
fixed effort constants baked into each rate-table row (listed per service below).

---

## 1. Payroll 360 (sheet 5) — VERIFIED

Live calculator. Total `G26 = SUM(G6:G25)` — **no MAX**, so the $25k minimum is not enforced
(operator decision: apply `MAX(subtotal,$25,000)` in the rebuild).

**Base — banded per-employee (G6, 7 bands), rate = (hrs×2400)/ceiling:**

| Band (headcount) | Member $/emp | Non-Mem $/emp | Cells |
|---|---|---|---|
| <201 | 90 | 97.5 | G30/I30 |
| <501 | 48 | 52 | G31/I31 |
| <1001 | 30 | 32.5 | G32/I32 |
| <2001 | 18 | 19.5 | G33/I33 |
| <3001 | 14 | 15.1667 | G34/I34 |
| <4001 | 12 | 13 | G35/I35 |
| 4001+ | 12 | 13 | G36/I36 |

**Flat scope add-ons (IF Yes):** Process 7200/7800 (G40/I40); Governance & Controls 7200/7800
(G41/I41); People 2400/2600 (G42/I42).

**Per-unit add-ons:** Simple Awards `count×18000/19500` (G47/I47); Complex Awards
`count×24000/26000` (G51/I51); Different Payroll Systems `MAX(count−1,0)×2400/2600` (G65/I65,
first system free); Pay Code Qty stepped `<300→0, <400→2400/2600, <500→4800/5200` (G77-79).

**EBA Core (cumulative tiers, G55-58):** 1→24000/26000; 2→42000/45500; 3→54000/58500;
each additional +12000/+13000.
**EBA State (G59-61):** 1→12000/13000; 2→18000/19500; each additional +6000/+6500.
**Independent entities requiring own system (stepped, G69-73):** 1→0; 2→1200/1300;
3→3600/3900; 4→7200/7800; 5→9600/10400; 6+ → `"CHECK"`.

**% modifiers — each `rate × SUM(G6:G16)`:** In-house No +15% (F84); Knowledge gap Yes +15%
(F88)/No 0 (F89); Data quality No +15% (F94)/Yes 0; Manual Yes15/Partial10/No0 (F98-100);
ASX +15% (F104); Under Privilege +10% (F105); NFP −15% (F106); New Zealand Yes +15% (F110);
Prolonged Onboarding Yes +15% (F115). Modifier base is `SUM(G6:G16)` (base+scope+units+EBA+
systems+paycodes).

**Effort day constants (rate table):** Process/Gov 3d, People 1d; Simple 7.5d, Complex 10d;
EBA core 10/7.5/5d; systems 1d.

---

## 2. Compliance Review (sheet 6)

Live calculator. Total `G20 = SUM(G5:G19)` — **no min fee**.

**Base bands (G5, 7 bands):**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <201 | 30 | 32.5 | G24/I24 |
| <501 | 24 | 26 | G25/I25 |
| <1001 | 18 | 19.5 | G26/I26 |
| <2001 | 12 | 13 | G27/I27 |
| <3001 | 10 | 10.8333 | G28/I28 |
| <4001 | 9 | 9.75 | G29/I29 |
| 4001+ | 9 | 9.75 | G30/I30 |

**Per-unit:** Simple Awards `count×18000/19500` (G34/I34); Complex Awards `count×24000/26000`
(G38/I38); Payroll Systems `MAX(count−1,0)×2400/2600` (G52/I52); Pay Code Qty
`<300→0, <400→2400/2600, <500→4800/5200` (G57/G58).
**EBA Core tiers (G42-45):** 1→24000/26000; 2→42000/45500; 3→54000/58500; additional
+12000/+13000. **EBA State (G46-48):** 1→12000/13000; 2→18000/19500; additional +6000/+6500.

**% modifiers — each `rate × SUM(G5:G9)`** (base + simple + complex + EBA-core + EBA-state
ONLY; excludes systems G10 and pay codes G11): In-house No +15% (F63); Knowledge gap Yes +15%
(F67)/No 0; Data quality No +15% (F73)/Yes 0; Manual 15/10/0 (F77-79); **ASX +30%** (F83 —
note double the 360's rate); Privilege +10% (F84); NFP −15% (F85); NZ +15% (F89).
No Prolonged Onboarding, no entities line.

---

## 3. Optimisation Review (sheet 7) — NOT day-rate

Live calculator. **Structure = scope-sum multiplied by a headcount band factor.**
Total `G17 = SUM(G5:G16)` — no min fee.

**Scope add-ons (IF Yes), summed into `SUM(G5:G7)`:** Process 7200/7800 (G21/I21);
Governance & Controls 7200/7800 (G22/I22); People 2400/2600 (G23/I23).

**Base line (G8) = headcount-band multiplier × SUM(G5:G7):**

| Band (headcount) | Multiplier | Cell |
|---|---|---|
| <400 | 0.2 | G27 |
| <750 | 0.5 | G28 |
| <1000 | 1.5 | G29 |
| <1500 | 2 | G30 |
| <2000 | 2.5 | G31 |
| <5000 | 3 | G32 |
| 5000+ | 3.5 | G33 |

**% modifiers — each `rate × SUM(G5:G7)`** (scope subtotal only, not the multiplied base):
In-house No +15% (F38); Knowledge gap Yes +15% (F42); Data quality No +15% (F48);
Manual 15/10/0 (F52-54); ASX/Corporate +15% (F58); Privilege +10% (F63); NZ +15% (F68);
NFP −15% (F59).

---

## 4. PayCompliance (sheet 8)

Live calculator. Total `G21 = MAX(SUM(G7:G20), 15000)` — **min engagement $15,000 enforced**.
Min stated at D5/F5.

**Base bands (G7, 8 bands):**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <201 | 0 | 0 | G25/I25 |
| <501 | 12 | 13 | G26/I26 |
| <751 | 16 | 17.3333 | G27/I27 |
| <1001 | 18 | 19.5 | G28/I28 |
| <1501 | 16 | 17.3333 | G29/I29 |
| <2001 | 15 | 16.25 | G30/I30 |
| <5001 | 7.2 | 7.8 | G31/I31 |
| 5001+ | 7.2 | 7.8 | G32/I32 |

**Awards — up to 4, each by complexity Level 1-4 (G8-G11 look up G36-G39):**

| Level | Member $ | Non-Mem $ | Cells |
|---|---|---|---|
| 1 | 6600 | 7150 | G36/I36 |
| 2 | 7800 | 8450 | G37/I37 |
| 3 | 10200 | 11050 | G38/I38 |
| 4 | 12600 | 13650 | G39/I39 |

**Per-unit:** Different Payroll Systems `MAX(count−1,0)×2400/2600` (G43/I43).

**% modifiers — each `rate × SUM(G7:G11)`** (base + 4 award slots): Knowledge gap Yes +10%
(F47)/No 0; Data quality No +15% (F53)/Yes 0; In-house No +15% (F58); Manual 15/10/0 (F62-64);
ASX +15% (F68); Privilege +10% (F78); NZ +15% (F73); NFP −15% (F69).

---

## 5. Health Check (sheet 9)

Live calculator. Total `G22 = MAX(SUM(G8:G21), 25000)` — **min engagement $25,000 enforced**.

**Fixed Health Check base fee (G8 = G26):** 15000 / 16250 (Member/Non-Member), 6.25d effort.

**Employee bands (G9, 8 bands) — added on top of the fixed base:**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <201 | 0 | 0 | G30/I30 |
| <501 | 14.4 | 15.6 | G31/I31 |
| <751 | 24 | 26 | G32/I32 |
| <1001 | 24 | 26 | G33/I33 |
| <1501 | 20 | 21.6667 | G34/I34 |
| <2001 | 18 | 19.5 | G35/I35 |
| <5001 | 8.4 | 9.1 | G36/I36 |
| 5001+ | 8.4 | 9.1 | G37/I37 |

**Awards — up to 3, complexity Level 1-4 (G10-G12 → G41-G44):** identical table to
PayCompliance: 1→6600/7150, 2→7800/8450, 3→10200/11050, 4→12600/13650.
**Per-unit:** Payroll Systems `MAX(count−1,0)×2400/2600` (G48/I48).

**% modifiers — each `rate × SUM(G8:G12)`** (fixed base + employees + 3 award slots):
In-house No +15% (F53); Knowledge gap Yes +10% (F57); Data quality No +15% (F63);
Manual 15/10/0 (F67-69); ASX/Corporate +15% (F73); Privilege +10% (F78); NZ +15% (F83);
NFP −15% (F74). "Common Systems" block exists but is labelled **NOT CURRENTLY INCLUDED IN
PRICING** (D86/H86) — ignore.

---

## 6. PayReview (sheet 10) — VERIFIED

Live calculator. Total `G11 = MAX(SUM(G7:G10), 12500)` — **min $12,500 enforced**.
**Flat base fee, not per-employee:** `G7 = 15000` Member / `16250` Non-Member for any
headcount (`IF(F7<500,G15,G15)` — both branches are G15, so headcount is ignored). G15 base
= 15000/16250.

**% modifiers — each `rate × G7` (base):** In-house No +15% (F20); Knowledge gap Yes **+10%**
(F24); Data quality No **+10%** (F30). **Correction to `pricing-model-analysis.md`:** it listed
Knowledge-gap +10% and Data-quality +15% — the cells show Knowledge-gap **+10%** and
Data-quality **+10%** (F24=0.1, F30=0.1).

---

## 7. BOOT Evaluation (sheet 11) — NOT day-rate; remediation-style w/ Tech Costs

Live calculator with **two money columns**: professional fee (Member G, Non-Member J) and a
separate **Tech Costs** column (Member H, Non-Member K). Fee total `G20 = SUM(G5:G19)`;
Tech total `H20 = SUM(H5:H19)`. **No min fee.**

**Base bands (G5, 8 bands):**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <101 | 60 | 65 | G24/I24 |
| <201 | 60 | 65 | G25/I25 |
| <501 | 48 | 52 | G26/I26 |
| <1001 | 36 | 39 | G27/I27 |
| <1501 | 28 | 30.3333 | G28/I28 |
| <2001 | 24 | 26 | G29/I29 |
| <5001 | 10.8 | 11.7 | G30/I30 |
| 5000+ | 10.8 | 11.7 | G31/I31 |

**Pay Frequency multiplier (G6 = factor × base G5):** Weekly 0 (F35); Fortnightly 1 (F36);
Monthly 1.5 (F37). Added as a line.
**Recalculation Period multiplier (G7 = factor × base G5):** 12mo→0 (G41); 24mo→1 (G42);
36mo→2 (G43); 48mo→3 (G44); 60mo→4 (G45); else `"CHECK"`. Added as a line.

**Tech Costs lines:**
- Compliance Tool – New award interpretation: `IF(Yes, 20000, 0)` → H8/K8 (Tech).
- **WageSafe employee licence** `H9 = months × $3 × headcount` where months parsed from the
  Recalc Period string (F7), per-employee audit fee **$3** (F49). → Tech.
- **WageSafe licence cost** `H10` manual input; monthly rate **$1,000/month** (F53). → Tech.

**Per-unit fee lines:** Simple Awards `count×12000/13000` (G57/I57); Complex Awards
`count×18000/19500` (G61/I61).
**EBA Core (G65-68):** 1→24000/26000; 2→42000/45500; 3→54000/58500; additional +12000/+13000.
**EBA State (G69-71):** 1→12000/13000; 2→18000/19500; additional +6000/+6500.

**% modifiers — each `rate × SUM(G5:G14, G19)`** (base+freq+recalc+awards+EBA plus back-pay
G19): ASX +15% (F75); Privilege +10% (F76); NFP −15% (F77); Bad Data quality +10% (F81).
**Back-pay types (G19) = `MIN(count×10%, 1000%) × SUM(G5:G14)`** — note **10%/type** here
(vs 20% in Remediation).

---

## 8. Technology Procurement (sheet 12) — NOT day-rate

Live calculator. Total `G13 = SUM(G5:G12)` — no min fee.

**Base bands (G5, 5 bands):**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <1001 | 0 | 0 | G17/I17 |
| <2001 | 3 | 3.25 | G18/I18 |
| <3001 | 4 | 4.3333 | G19/I19 |
| <4001 | 4.5 | 4.875 | G20/I20 |
| 4001+ | 4.5 | 4.875 | G21/I21 |

**Requirement Gathering (banded count, G6):** <3 → `"CHECK"`; 3-5 (<6) → 14400/15600 (G25/I25);
6-8 (<9) → 18000/19500 (G26/I26); 9-12 (<13) → 21600/23400 (G27/I27); ≥13 → `"CUSTOM"`.
**Vendor Recommendations (banded count, G7):** <1 → `"CHECK"`; 1-3 (<4) → 14400/15600 (G31);
4-6 (<7) → 18000/19500 (G32); 7-9 (<10) → 21600/23400 (G33); 10-12 (<13) → 25200/27300 (G34);
≥13 → `"CUSTOM"`.
**Additional system review (G8):** 0→0; 1 (<2) → 9600/10400 (G38); 2 (<3) → 14400/15600 (G39);
≥3 → `"CUSTOM"`.

**% modifiers:** Legal privilege Yes **+20%** (F44) × `SUM(G5:G8)`; Full Process Yes **+20%**
(F49) × `SUM(G5:G9)`; ASX/Corporate +15% (F54) × `SUM(G5:G9)`; NFP −15% (F55) × `SUM(G5:G9)`.

---

## 9. Remediation (sheet 13) — master remediation engine, Tech Costs

Live calculator. Two money columns: fee (Member G / Non-Member J), Tech Costs (H / K).
Fee total `G24 = SUM(G7:G23)`; Tech total `H24 = SUM(H7:H23)`. **No min fee.**

**Base bands (G7, 8 bands):**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <101 | 60 | 65 | G28/I28 |
| <201 | 60 | 65 | G29/I29 |
| <501 | 48 | 52 | G30/I30 |
| <1001 | 36 | 39 | G31/I31 |
| <1501 | 28 | 30.3333 | G32/I32 |
| <2001 | 24 | 26 | G33/I33 |
| <5001 | 10.8 | 11.7 | G34/I34 |
| 5000+ | 10.8 | 11.7 | G35/I35 |

**Recalculation Period multiplier (G8 = factor × base G7), table G39-47:**

| Period | Factor | Cell |
|---|---|---|
| ≤2 months | 0.10 | G39 |
| 3 months | 0.25 | G40 |
| 6 months | 0.50 | G41 |
| 12 months | 1.00 | G42 |
| 24 months | 1.50 | G43 |
| 36 / 48 / 60 / 72 months | 1.50 | G44-47 (flat cap) |

**Compliance Tool – New award interpretation (fee line G9):** `IF(Yes, 24000/26000, 0)` — G51
(this is a FEE line, col G, not Tech).
**Singular types of award interpretation (G10) = factor × base G7:** 1→0.2, 2→0.4, 3→0.6,
4→0.8, 5→1.0, 6→1.2 (G55-60); out of range → `"CHECK"`.

**Tech Costs lines:**
- **WageSafe employee licence** `H11 = months(from Recalc F8) × $3.50 × headcount`; per-employee
  audit fee **$3.50** (F64). → Tech.
- **WageSafe licence cost** `H12 = months(own period F12) × $1,000/month` (F68). → Tech.

**Per-unit fee lines:** Simple Awards `count×12000/13000` (G72/I72); Complex Awards
`count×18000/19500` (G76/I76).
**EBA Core (G80-83):** 1→24000/26000; 2→42000/45500; 3→54000/58500; additional +12000/+13000.
**EBA State (G84-86):** 1→12000/13000; 2→18000/19500; additional +6000/+6500.

**% modifiers — each `rate × SUM(G7:G16, G23)`** (base+recalc+awards+EBA plus back-pay G23):
Knowledge gap Yes +15% (F90); ASX +15% (F95); Privilege +10% (F96); NFP −15% (F97);
Bad Data quality +10% (F101).
**Rostering Pattern (G22) = `IF(Yes, 0.3, 0) × SUM(G7:G21, G23)`** (F105 = 30%; wider base
includes the modifier lines G17-21).
**Back-pay types (G23) = `MIN(count×20%, 1000%) × SUM(G7:G8)`** — **20%/type**, base = emp+recalc.

---

## 10. System Implementation Support (sheet 14) — NOT day-rate

Live calculator. Total `G23 = SUM(G5:G22)` — no min fee.

**Base bands (G5, 8 bands; <201 = free):**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <201 | 0 | 0 | (formula) |
| <501 | 12 | 13 | G27/I27 |
| <1501 | 8 | 8.6667 | G28/I28 |
| <2251 | 10.6667 | 11.5556 | G29/I29 |
| <3001 | 12 | 13 | G30/I30 |
| <4001 | 12 | 13 | G31/I31 |
| <5001 | 12 | 13 | G32/I32 |
| 5001+ | 12 | 13 | G33/I33 |

**Flat scope add-ons (IF Yes):** Award Interpretation documentation 7200/7800 (G37);
System testing 7200/7800 (G38); Parallel Run Support 7200/7800 (G39).
**Process documentation (G9):** Enterprise → 12000/13000 (G43); Simple → 6000/6500 (G44);
Not required → 0 (G45).

**Awards/EBAs as EFFORT MULTIPLIERS on `SUM(G5:G9)`** (base+scope+processdoc):
Simple `SUM(G5:G9)×(count×0.1)` (F49); Complex `×(count×0.2)` (F50);
EBA Core `×(count×0.2)` (F51); EBA State `×(count×0.1)` (F52).

**% modifiers — each `SUM(G5:G13) × rate`** (base+scope+processdoc+award-multipliers):
Process documentation provided No +15% (F57); In-house No +15% (F62); Knowledge gap Yes +10%
(F66); Data quality No +15% (F72); Manual 15/10/0 (F76-78); ASX +15% (F82); Privilege +10%
(F87); NZ +15% (F92); NFP −15% (F83).

---

## 11. STP2 Review (sheet 15) — NOT day-rate

Live calculator. Total `G13 = SUM(G5:G12)` — no min fee.

**Base — banded by pay-code / scope count (G5):** <201 → 1200/1300 (G17); <301 → 2400/2600
(G18); <401 → 3600/3900 (G19); <501 → 4800/5200 (G20); ≥501 → `"CHECK"`.
**Different Payroll Systems (G6) = `MAX(count−1,0)×2400/2600`** (F24/G24, first free).

**Scope toggles — each `rate × SUM(G5:G6)` (base + systems):**
PayCodes Review Yes **+50%** (G28=0.5); Superannuation Yes **+50%** (G32=0.5);
Terminations Yes **+50%** (G36=0.5); Payroll Tax Yes **+200%** (G40=2, "please avoid");
PAYG Yes **+50%** (G44=0.5); Good Data Quality No +15% (F49)/Yes 0.

---

## 12. Award Interpretation (sheet 16) — VERIFIED (fixed complexity card)

Live but trivial: a fixed fee by complexity rating, `G = effort_days × 2400`,
`H(non-mem) = effort_days × 2600`. This is the standalone Award-Interpretation service card
(distinct from per-tab award prices).

| Complexity | Effort (days) | Member $ | Non-Mem $ | Cells |
|---|---|---|---|---|
| 1 (Simple) | 1.5 | 3600 | 3900 | G3/H3 |
| 2 | 2.5 | 6000 | 6500 | G4/H4 |
| 3 | 5 | 12000 | 13000 | G5/H5 |
| 4 (Complex) | 7.5 | 18000 | 19500 | G6/H6 |
| EA/EBA | 7.5 | 18000 | 19500 | G7/H7 |

Note: this sheet uses column **H** for Non-Member (not I). No modifiers, no bands, no min.

---

## 13. Super Review (sheet 17) & LSL Review (sheet 18) — identical engine

Both live calculators, byte-for-byte identical structure. Total `G8 = SUM(G5:G7)` — no min fee.

**Base bands (G5, 7 bands):**

| Band | Member $/emp | Non-Mem | Cells |
|---|---|---|---|
| <501 | 24 | 26 | G12/I12 |
| <1501 | 12 | 13 | G13/I13 |
| <2501 | 9.6 | 10.4 | G14/I14 |
| <3501 | 8.5714 | 9.2857 | G15/I15 |
| <4501 | 8 | 8.6667 | G16/I16 |
| <5501 | 7.6364 | 8.2727 | G17/I17 |
| 5501+ | 7.6364 | 8.2727 | G18/I18 |

**Recalculation Period multiplier (G6 = factor × base G5), table G22-25:**
6 months → 0 (G22); 24 months → 0.5 (G23); 36 months → 1 (G24); "Up to 6 years" → 1.5 (G25);
else → `"CHECK"`.
**% modifier:** Good Data Quality No **+15%** (F30) × `SUM(G5:G6)`; Yes → 0. (Only modifier.)

---

## 14. Reference / worked-example logs (sheets 25, 29, 30, 32) — NOT calculators

All four are historical **deal logs** in the same shape as sheet 2 (Projects) — one row per
past deal with columns Project, Consultant, Emps, EBAs/Awards, Recalc period, Services, Hours,
Actual, Fee, Profit, "New Days"/"New Fee" (re-priced under new rates), Comments. Formulas are
per-row bookkeeping only (`Days = Hours/7.6` or `Fee/2000`, `Profit = Fee − Actual`,
`New Fee = New Days × 2000`, variance columns). **No engine logic; import as calibration data.**

- **Sheet 25 "Tech":** Technology Procurement deals (ABA, Bank Vic, Costco, Kinetic IT, etc.).
- **Sheet 29 "Leave":** Leave-accrual remediation deals.
- **Sheet 30 "Super Rem":** Superannuation remediation deals.
- **Sheet 32 "SysImp":** Implementation-support / parallel-run deals.

---

## Cross-service notes for the engine build

- **Modifier base differs per service** — always the `SUM(...)` range in the actual line
  formula, NOT a fixed "subtotal". Ranges captured above per service (e.g. 360 = G6:G16,
  Compliance = G5:G9, Remediation = G7:G16+G23). Transcribe the exact range.
- **"CHECK"/"CUSTOM" sentinels** appear as string outputs on out-of-range inputs
  (Procurement counts, STP2 ≥501, entities ≥6, recalc periods). Per operator decision: warn,
  don't block, never write the sentinel into a money field.
- **Tech Costs** (BOOT, Remediation) are a parallel total; per operator decision the deal value
  = professional fee + Tech Costs, shown as a separate breakdown line.
- **Award complexity Level 1-4** fee tables: PayCompliance & Health Check share
  6600/7800/10200/12600 (Member). The 360/Compliance/BOOT/Remediation tabs instead use flat
  Simple/Complex per-award prices (18000/24000 for 360; 12000/18000 for BOOT & Remediation).
  Award pricing is service-specific — store one config per service.
- **Corrections to `pricing-model-analysis.md`:** (a) PayReview Knowledge-gap = +10%,
  Data-quality = +10% (not 15%). (b) Compliance ASX = +30% (not 15%). (c) Optimise, BOOT,
  Procurement, Implementation, STP2, Super, LSL are **not** "day-rate" services — each has the
  concrete structure documented above. (d) Remediation back-pay = 20%/type; BOOT back-pay =
  10%/type; WageSafe per-employee audit fee = $3.50 (Remediation) / $3 (BOOT); WageSafe licence
  = $1,000/month (both).
