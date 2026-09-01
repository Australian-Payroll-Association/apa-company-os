# Pricing Model Analysis — APA Services Calculator (reverse-engineered from Excel)

Source: extracted OOXML of the consultant pricing workbook. This spec describes the
pricing **logic** so the Front Door app can auto-populate deal value from a small set
of drivers. Nothing in the workbook was modified.

> TL;DR — It is **one common engine** reused across ~13 service tabs, each with its own
> configuration (which drivers apply, the rate table values, and the minimum fee). Every
> price is built from days × a fixed **day rate** ($2,400/day for members, $2,600/day for
> non-members), assembled as: **banded per-employee base fee + flat scope add-ons +
> per-unit award/EBA/system add-ons + a stack of percentage modifiers**, then floored at a
> per-service **minimum engagement fee**. There is **no GST** anywhere. Discounts exist only
> as the NFP modifier (−15%). No dedicated consultant "override" cell.

---

## 1. Overview — how a price is built end-to-end

Each service has its own worksheet (the "calculator"). Layout is consistent:

- **Column D** = driver labels (the questions).
- **Column F** = the consultant's **inputs** (headcount, Yes/No flags, counts, band pickers).
- **Column G** = computed **Member** dollar amount for each line.
- **Column I** (or J) = computed **Non-Member** dollar amount for each line.
- **Columns H / J** = the same line expressed in **days** (dollar ÷ day rate) — for effort sanity-checking.
- A **Total** row = `SUM` of the line items (some services wrap it in `MAX(…, minimum)`).
- Below the input block sits an on-sheet **rate table** (roughly rows 24–120) holding the
  band breakpoints, per-unit prices and percentage constants that the input formulas look up.
  The developer should lift these constants into config, not hard-code them in logic.

The pipeline for a single service:

```
base_fee      = banded_per_employee_rate(headcount) * headcount      # declining $/emp by size band
+ scope_addons = Σ (flat fee for each "Yes" scope item)              # Process, Governance, People…
+ unit_addons  = Σ (count * price_per_unit)                          # simple/complex awards, EBAs, systems, entities, pay codes
= subtotal
* (1 + Σ percentage_modifiers)                                       # in-house payroll, knowledge gap, data quality,
                                                                     #   manual processes, ASX, privilege, NFP(−), NZ, onboarding
= service_fee  (Member and Non-Member computed in parallel columns)
service_fee    = MAX(service_fee, minimum_engagement_fee)            # only some services enforce this
```

Percentage modifiers are **not** compounded individually; each is computed as
`rate% * subtotal` and the results are **summed** alongside the base lines, i.e. effectively
`subtotal * (1 + Σ rates)`. The modifier base is the subtotal of the base + fixed + unit lines
(e.g. 360 uses `SUM(G6:G16)`).

**Remediation is the one structural variant:** it carries a **second parallel money column
for "Tech Costs"** (WageSafe licence + per-employee audit fees) that is totalled separately
from the consulting fee, and it multiplies the base by a **recalculation-period factor**.

---

## 2. Rate cards / global constants

| Constant | Value | Where |
|---|---|---|
| **Member day rate** | **$2,400 / day** | every service `G = days * 2400` |
| **Non-member day rate** | **$2,600 / day** | every service `I = days * 2600` |
| Internal costing basis (Projects log) | $2,400/day ÷ 8h ≈ **$300/hr** | Projects `Hours = Actual/2400*8` |
| Standard "day" for effort→fee | 2,000 in some tabs, 2,400 in others | rate tables divide $ by 2000 or 2400 to show days — **inconsistent, confirm with operator** |

### Award-complexity → fee (the master effort table, sheet "Award Interpretation" = sheet16)
Ties each award's complexity rating (1–4, from the Award Effort Matrix) to a fee:

| Complexity | Effort | Member fee | Non-member fee |
|---|---|---|---|
| 1 (Simple) | 12 h (1.5 d) | $3,600 | $3,900 |
| 2 | 20 h (2.5 d) | $6,000 | $6,500 |
| 3 | 40 h (5 d) | $12,000 | $13,000 |
| 4 (Complex) | 60 h (7.5 d) | $18,000 | $19,500 |
| EA / EBA | 60 h (7.5 d) | $18,000 | $19,500 |

Note the per-tab award prices differ from this master table (e.g. Payroll 360 charges a
**Simple award = $18,000** and **Complex = $24,000**), so award pricing is **service-specific**,
not a single global rate. Treat the Award Interpretation table as the standalone-service card.

### Award Effort Matrix (sheet3) — reference lookup, no formulas
122 modern awards, one row each:
- **A** Award name (e.g. "Aged Care Award [MA000018]")
- **B** Level of time/effort, **scale 1 (Simple) – 4 (Complex)**
- **C** Free-text note on what makes it complex
- **D** "Interpreted Y/N?" (has APA already built the interpretation)

This is the source for the "award complexity (1–4)" input that several calculators ask the
consultant to enter. It is pure data — the app should import it as a table keyed by award.

### Projects (sheet2) — historical deal log, NOT a live calculator
219 rows of past deals. Columns: Project, Consultant, Service, Emps No, Industry,
Recalculation period, 24/7?, Multi-state?, EBA core, EBA state, Simple/Complex awards,
Pay Codes, STP2, Payroll Tax, Super, Pay Frequency, **Hours (S), Actual (T), Fee (U),
Profit (V), Actual Rate/hr (W), Timeline, Due Date, Customer Rate (Z), Comment**.
Only three formula types, all per-row:
- `V (Profit) = U − T` (Fee − Actual cost)
- `W (Rate/hr) = U / S` (Fee ÷ Hours)
- `T (Actual) = Z * S` (Customer Rate × Hours) — for rows priced that way
- `S (Hours) = T / 2400 * 8` — back-solving hours from cost at the $2,400/day, 8h/day basis
Use it as calibration/benchmark data (what real deals actually sold for), not as engine logic.
**Sheets 20–33 are the same idea per service** (worked-example logs: 360, Health Check,
Compliance, BOOT, Remediation, etc.), plus sheet1 is a superset deal log. All reference data.

---

## 3. Inputs (price-drivers), by type

### 3a. The base fee — **banded per-employee multiplier** (tiered × headcount)
Consultant enters **Number of Employees**; the engine picks a per-employee $ rate from a
size band, then multiplies by the actual headcount. The per-employee rate **declines** as
size grows (volume taper). Rates are pre-computed in the rate table as
`(hours_for_band * day_rate) / band_ceiling`.

Payroll 360 bands (Member, sheet5 rows 30–36) — `rate = (hrs*2400)/ceiling`:

| Headcount band | Member $/emp | Non-member $/emp |
|---|---|---|
| 0–200 (<201) | 90 | 97.5 |
| 201–500 (<501) | 48 | 52 |
| 501–1000 (<1001) | 30 | 32.5 |
| 1001–2000 (<2001) | 18 | 19.5 |
| 2001–3000 (<3001) | 14 | 15.17 |
| 3001–4000 (<4001) | 12 | 13 |
| 4001+ | 12 | 13 |

Example: 717 emps → falls in 501–1000 → 717 × $30 = **$21,510** (member).

Compliance Review (sheet6) uses the same 7 bands but lower rates (e.g. 0–200 → **$30/emp**
member → 100 emps = $3,000). Remediation (sheet13) uses **8** finer bands
(<101,<201,<501,<1001,<1501,<2001,<5001,5001+) starting at $60/emp for 0–100.
PayReview (sheet10) collapses to a single **flat fee** for "up to 500 emps" ($15,000 member /
$16,250 non-member) — a flat rate, not a per-employee multiplier.
**⇒ Band breakpoints and per-emp rates are per-service; store one table per service.**

### 3b. Flat scope add-ons (fixed fee when toggled "Yes")
Yes/No switches that add a fixed dollar amount. Payroll 360 examples:
- **Process** → $7,200 M / $7,800 NM (3 days)
- **Governance & Controls** → $7,200 / $7,800
- **People** → $2,400 / $2,600 (1 day)

Formula shape: `= IF(F="Yes", rate, 0)`.

### 3c. Per-unit multipliers (count × price)
- **Number of Simple Awards** → `count × price` (360: $18,000 M each; Compliance: $24,000)
- **Number of Complex Awards** → `count × price` (360: $24,000 M each)
- **Different Payroll Systems** → `MAX(count−1, 0) × price` (first system free; 360: $2,400 each extra)
- **Pay Code Qty** → banded step (<300 → $0, <400 → $2,400, <500 → $4,800)

### 3d. Tiered / stepped lookups (banded thresholds → discrete fee)
- **EBA — No. of Core Industry agreements** (cumulative tiers): 360 → 1st $24,000,
  2 cumulative $42,000, 3+ $54,000, each additional $12,000. Compliance uses
  `IF(F=1,…,F=2,…,F=3,…, base+(F−3)*extra)`.
- **State agreements (based on Industry)**: 1st $12,000, 2+ $18,000, additional $6,000 (360).
- **Independent entities requiring own system**: stepped 1→$0, 2→$1,200, 3→$3,600,
  4→$7,200, 5→$9,600, else "CHECK".

### 3e. Percentage modifiers (applied to the subtotal)
Each is `rate% × subtotal` and summed into the total. Payroll 360 set (sheet5 rows 84–116):

| Driver | Condition | Rate |
|---|---|---|
| In-house payroll | No | +15% |
| Payroll Knowledge Gap | Yes | +15% |
| Good Data Quality | No | +15% |
| Manual Processes | Yes / Partial / No | +15% / +10% / 0 |
| ASX-Listed Corporate | Yes | +15% |
| Under Privilege | Yes | +10% |
| **NFP** | Yes | **−15% (discount)** |
| New Zealand | Yes | +15% |
| Prolonged Onboarding | Yes | +15% |

Other services carry a subset (PayReview only has In-house +15%, Knowledge Gap +10%,
Data Quality +15%). Remediation adds **Bad Data quality / Data Scientist** and **Rostering
Pattern** modifiers, and a capped **Types of Back Pay Calculations** factor
`MIN(count × 20%, 1000%) × base`.

### 3f. Remediation-only drivers
- **Recalculation Period** (1–60+ months): a lookup factor `G39…G47` **multiplies the base**
  (longer lookback → higher multiple).
- **WageSafe employee licence** = `months × $3.50 × headcount` → **Tech Costs** column (separate total).
- **WageSafe licence cost** = `months × per-month rate` → Tech Costs.
- **Compliance Tool – new award interpretation** add-on.
Fee total and Tech-Costs total are reported separately (`G24` fee, `H24` tech).

---

## 4. Per-service summary — one model, many configs

| Sheet | Service | Base fee style | Award/EBA drivers | % modifiers | Min fee | Notes |
|---|---|---|---|---|---|---|
| 5 | Payroll 360 | Banded /emp (7 bands) | Simple, Complex, EBA, State, Systems, Entities, Pay codes | Full 9-item stack | $25,000 (documented, **not enforced** in total) | The reference/most complete engine |
| 6 | Compliance Review | Banded /emp (7 bands) | Simple, Complex, EBA, State, Systems | Subset | — | |
| 7 | Optimisation Review | day-rate based | — | — | — | Smaller calculator |
| 8 | PayCompliance | Banded /emp | Award-effort driven ("EA effort defined by Award") | Subset | **$15,000** (`MAX`) | |
| 9 | Health Check | Banded /emp | Awards | Subset | **$25,000** (`MAX`) | |
| 10 | PayReview | **Flat** (<500 → $15,000) | — | In-house, Knowledge gap, Data quality | **$12,500** (`MAX`) | Simplest |
| 11 | BOOT Evaluation | day-rate based | Awards | Subset | — | |
| 12 | Technology Procurement | day-rate based | — | — | — | |
| 13 | Remediation | Banded /emp (8 bands) | Simple, Complex, EBA, award-interp | Knowledge gap, ASX, Privilege, NFP, Bad-data, Rostering, Back-pay-types | — | **Recalc-period multiplier + separate WageSafe Tech Costs** |
| 14 | System Implementation Support | day-rate based | — | — | — | |
| 15 | STP2 Review | day-rate based | — | — | — | |
| 16 | Award Interpretation | **Fixed by complexity 1–4** | — | — | — | Master effort→fee card (§2) |
| 17 | Super Review | day-rate based | — | — | — | |
| 18 | LSL Review | day-rate based | — | — | — | |

Members vs Non-Members: **every** service computes both in parallel. The only difference is
the day rate ($2,400 vs $2,600 ≈ +8.3%) and the corresponding rate-table column; flat fees
and per-unit prices are set slightly higher for non-members (e.g. $7,200 vs $7,800).
Percentage modifiers are identical for both.

---

## 5. GST / discounts / minimum fees / overrides

- **GST:** none. No "GST", tax, or 10% gross-up appears in any sheet, string, or formula.
  Prices are ex-GST; the app should add GST at display/quote time if required (confirm).
- **Discounts:** the only built-in discount is the **NFP modifier (−15%)** on the subtotal
  (present in 360 and Remediation). No promo/volume discount fields.
- **Minimum engagement fees:** enforced via `MAX(subtotal, min)` in **PayReview ($12,500)**,
  **PayCompliance ($15,000)**, **Health Check ($25,000)**. Payroll 360 documents a $25,000
  minimum in a label but its Total does **not** apply the `MAX` — likely an oversight; confirm.
- **Consultant override:** there is **no dedicated override cell**. Because it is Excel, a
  consultant can type over any computed cell; the "final quoted value" is simply the Total
  row (Member or Non-Member). The app should provide an explicit editable override field.

---

## 6. Open ambiguities — RESOLVED (operator decisions, 2026-09-01)

All operator-facing ambiguities below are now answered. Recorded here and folded into Epic A
in `epics.md`.

1. **Day divisor inconsistency:** ✅ RESOLVED. Day rates are confirmed **$2,400/day Member,
   $2,600/day Non-Member**. The stray `/2000` divisor lives only in secondary helper/display
   columns, not the price path — treat as a build-time cleanup detail, not a pricing rule.
2. **360 minimum fee not enforced:** ✅ RESOLVED — **cap it.** Apply `MAX(subtotal, $25,000)`
   to the 360 total, same pattern as PayReview / PayCompliance / Health Check.
3. **Which services actually apply the % modifier stack** vs. only day-rate build-up:
   sheets 7, 11, 12, 14, 15, 17, 18 are smaller — I confirmed the family/day-rate but did not
   trace every modifier. *(Build-time field-mapping task, not an operator decision — each such
   tab still needs its own mapping pass before coding.)*
4. **EBA/State agreement pricing in 360:** ✅ RESOLVED — **yes.** The 360 EBA-core and State
   inputs must change the 360 price; wire them into the 360 total the same way Compliance does.
5. **Recalculation-period factor table (Remediation G39–G47):** ✅ RESOLVED. Multiplier on the
   Remediation base fee, keyed on months recalculated: **≤2mo → 0.10, 3mo → 0.25, 6mo → 0.50,
   12mo → 1.00, 24mo → 1.50**, and **flat-capped at 1.50** for 36/48/60/72mo and any period
   beyond 24 months.
6. **"CHECK" sentinels:** ✅ RESOLVED — **warn, do not block.** Surface a warning on
   out-of-range inputs; never write "CHECK" into a money field. Submission is not blocked.
7. **WageSafe / tech costs:** ✅ RESOLVED. For Remediation, **deal value = professional fee +
   WageSafe tech costs** (tech costs totalled and included in the deal value; still shown as a
   separate line in the breakdown).
8. **Consultant override (added):** ✅ RESOLVED — **yes**, add an explicit final-price override
   field. Overrides require **Ross's approval**; log the override value, the reason, and the
   approver.
9. **No macros/external links found** driving price (only one stray `#REF!` in a Projects
   profit cell). Logic is self-contained in the formulas — good news for a native rebuild.
