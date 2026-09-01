// Beryl ROI Calculator — shared model (company_os Build C).
// Pure functions + types, safe to import from both the server (PDF, usage log)
// and the client (instant in-browser calculation). No secrets, no I/O.

export interface RoiAssumptions {
  timeSavedMinMinutes: number
  timeSavedMaxMinutes: number
  workingHoursYear: number
  typicalQueriesPerUser: number
  signedOff: boolean
}

export interface BerylPrice {
  amountCents: number
  currency: string
}

export interface RoiInputs {
  teamSize: number
  queriesPerUser: number
  annualSalary: number // dollars per user per year (required)
}

export interface RoiResult {
  totalQueries: number
  hourlyRateCents: number
  monthlySavingLowCents: number
  monthlySavingHighCents: number
  annualSavingLowCents: number
  annualSavingHighCents: number
  berylCostCents: number
  netBenefitLowCents: number
  netBenefitHighCents: number
  roiMultipleLow: number
  roiMultipleHigh: number
}

const toCents = (dollars: number) => Math.round(dollars * 100)

/**
 * The one defensible model, shown conservative -> optimistic.
 *   total_queries = team_size x queries_per_user
 *   hourly_rate   = annual_salary / working_hours_year
 *   saving_low    = total_queries x (time_saved_min / 60) x hourly_rate
 *   saving_high   = total_queries x (time_saved_max / 60) x hourly_rate
 *   beryl_cost    = price x team_size
 *   net_benefit   = monthly_saving - beryl_cost
 *   roi_multiple  = monthly_saving / beryl_cost
 */
export function computeRoi(
  inputs: RoiInputs,
  a: RoiAssumptions,
  price: BerylPrice,
): RoiResult {
  const totalQueries = inputs.teamSize * inputs.queriesPerUser
  const hourlyRate = inputs.annualSalary / a.workingHoursYear // $/hr

  const monthlySavingLow = totalQueries * (a.timeSavedMinMinutes / 60) * hourlyRate
  const monthlySavingHigh = totalQueries * (a.timeSavedMaxMinutes / 60) * hourlyRate

  const berylCost = (price.amountCents / 100) * inputs.teamSize

  return {
    totalQueries,
    hourlyRateCents: toCents(hourlyRate),
    monthlySavingLowCents: toCents(monthlySavingLow),
    monthlySavingHighCents: toCents(monthlySavingHigh),
    annualSavingLowCents: toCents(monthlySavingLow * 12),
    annualSavingHighCents: toCents(monthlySavingHigh * 12),
    berylCostCents: toCents(berylCost),
    netBenefitLowCents: toCents(monthlySavingLow - berylCost),
    netBenefitHighCents: toCents(monthlySavingHigh - berylCost),
    roiMultipleLow: berylCost > 0 ? monthlySavingLow / berylCost : 0,
    roiMultipleHigh: berylCost > 0 ? monthlySavingHigh / berylCost : 0,
  }
}

/**
 * Format integer cents as a currency string. Rounds to whole dollars by default
 * (savings figures read cleaner), but pass { exact: true } for prices like
 * $49.95 where the cents are the point.
 */
export function formatCents(cents: number, currency = 'aud', opts: { exact?: boolean } = {}): string {
  const digits = opts.exact ? 2 : 0
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100)
}
