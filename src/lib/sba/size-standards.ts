/**
 * SBA Size Standards — construction-focused lookup + eligibility checker.
 *
 * Sources:
 *  - 13 CFR Part 121, Table of Small Business Size Standards (2024 edition)
 *  - NAICS 236–238 (construction), 541 (professional services), 561 (facility support)
 *
 * Design decisions:
 *  - Revenue thresholds stored in millions USD (e.g. 45 = $45M) for readability.
 *  - employee_count_range from capability_statements maps to conservative midpoints.
 *  - We use the MOST RECENT annual_revenue entry (highest year) for the revenue check.
 */

export interface SizeStandard {
  naics_prefix: string
  description: string
  threshold_type: 'revenue' | 'employees'
  threshold_value: number // millions for revenue, headcount for employees
  threshold_label: string // "$45.0M" or "500 employees"
}

export interface SizeEligibility {
  naics: string
  standard: SizeStandard
  status: 'eligible' | 'ineligible' | 'unknown'
  reason: string
  margin?: string // e.g. "$12.3M under threshold" or "250 employees under limit"
}

// ---------------------------------------------------------------------------
// Size standard table (construction-focused)
// ---------------------------------------------------------------------------

/**
 * Ordered from most-specific (longest prefix) to least-specific.
 * getSizeStandard() walks this list and returns the first match.
 */
const SIZE_STANDARD_TABLE: SizeStandard[] = [
  // ── NAICS 236: Construction of Buildings ──────────────────────────────────
  {
    naics_prefix: '236',
    description: 'Construction of Buildings',
    threshold_type: 'revenue',
    threshold_value: 45,
    threshold_label: '$45.0M',
  },
  // ── NAICS 237: Heavy and Civil Engineering Construction ───────────────────
  {
    naics_prefix: '237',
    description: 'Heavy & Civil Engineering Construction',
    threshold_type: 'revenue',
    threshold_value: 45,
    threshold_label: '$45.0M',
  },
  // ── NAICS 238: Specialty Trade Contractors ────────────────────────────────
  {
    naics_prefix: '238',
    description: 'Specialty Trade Contractors',
    threshold_type: 'revenue',
    threshold_value: 19,
    threshold_label: '$19.0M',
  },
  // ── NAICS 541: Professional, Scientific & Technical Services ──────────────
  // (Range $19M–$47.5M; use $22M as conservative construction-adjacent default)
  {
    naics_prefix: '541',
    description: 'Professional & Technical Services',
    threshold_type: 'revenue',
    threshold_value: 22,
    threshold_label: '$22.0M',
  },
  // ── NAICS 561: Administrative & Support Services ──────────────────────────
  {
    naics_prefix: '561',
    description: 'Administrative & Support Services',
    threshold_type: 'revenue',
    threshold_value: 20.5,
    threshold_label: '$20.5M',
  },
  // ── Default fallback ──────────────────────────────────────────────────────
  {
    naics_prefix: '',
    description: 'General Small Business',
    threshold_type: 'revenue',
    threshold_value: 20.5,
    threshold_label: '$20.5M',
  },
]

export function getSizeStandard(naics: string): SizeStandard {
  const code = naics.trim()
  // Walk from most-specific to least-specific; empty prefix is the fallback
  for (const standard of SIZE_STANDARD_TABLE) {
    if (standard.naics_prefix === '' || code.startsWith(standard.naics_prefix)) {
      return standard
    }
  }
  // Should never reach here — empty prefix always matches
  return SIZE_STANDARD_TABLE[SIZE_STANDARD_TABLE.length - 1]
}

// ---------------------------------------------------------------------------
// Employee count range → midpoint headcount mapping
// ---------------------------------------------------------------------------

/**
 * Maps the capability_statements.employee_count_range enum values to
 * conservative midpoints used for SBA headcount comparisons.
 *
 * Canonical range values from CapabilityStatementInput:
 *   '1-10' | '11-50' | '51-100' | '101-250' | '251-500' | '500+'
 *
 * '500+' maps to 750 (midpoint between 500 and the common 1,000 upper bound
 * for most employee-based standards). This is intentionally conservative —
 * if the firm might be near a 500-employee limit we should flag unknown.
 */
const EMPLOYEE_RANGE_MIDPOINTS: Record<string, number> = {
  '1-10': 5,
  '11-50': 30,
  '51-100': 75,
  '101-250': 175,
  '251-500': 375,
  '500+': 750,
}

function employeeRangeToCount(range: string): number | null {
  return EMPLOYEE_RANGE_MIDPOINTS[range] ?? null
}

// ---------------------------------------------------------------------------
// Revenue extraction from annual_revenue array
// ---------------------------------------------------------------------------

interface AnnualRevenueEntry {
  year: number
  revenue_usd: number
}

/**
 * Returns the most recent year's revenue_usd from the capability statement
 * annual_revenue JSONB array, or null if the array is empty / malformed.
 */
function mostRecentRevenue(
  annualRevenue: AnnualRevenueEntry[] | null | undefined,
): number | null {
  if (!annualRevenue || annualRevenue.length === 0) return null
  const sorted = [...annualRevenue].sort((a, b) => b.year - a.year)
  const entry = sorted[0]
  return typeof entry?.revenue_usd === 'number' ? entry.revenue_usd : null
}

// ---------------------------------------------------------------------------
// Core eligibility check
// ---------------------------------------------------------------------------

/**
 * Determine SBA small business size eligibility for a given NAICS code.
 *
 * @param naics              6-digit NAICS string
 * @param employeeCountRange Enum string from capability_statements (nullable)
 * @param annualRevenueUsd   Raw USD amount (nullable); pass the most recent
 *                           year's revenue or use the overload below.
 */
export function checkSizeEligibility(
  naics: string,
  employeeCountRange: string | null,
  annualRevenueUsd: number | null,
): SizeEligibility {
  const standard = getSizeStandard(naics)

  if (standard.threshold_type === 'employees') {
    if (employeeCountRange === null) {
      return {
        naics,
        standard,
        status: 'unknown',
        reason: 'Employee count not provided in capability statement.',
      }
    }
    const headcount = employeeRangeToCount(employeeCountRange)
    if (headcount === null) {
      return {
        naics,
        standard,
        status: 'unknown',
        reason: `Unrecognized employee range "${employeeCountRange}".`,
      }
    }
    const limit = standard.threshold_value
    if (headcount <= limit) {
      const under = limit - headcount
      return {
        naics,
        standard,
        status: 'eligible',
        reason: `Estimated headcount (~${headcount}) is under the ${standard.threshold_label} limit.`,
        margin: `~${under} employees under limit`,
      }
    } else {
      const over = headcount - limit
      return {
        naics,
        standard,
        status: 'ineligible',
        reason: `Estimated headcount (~${headcount}) exceeds the ${standard.threshold_label} limit.`,
        margin: `~${over} employees over limit`,
      }
    }
  }

  // threshold_type === 'revenue'
  if (annualRevenueUsd === null) {
    return {
      naics,
      standard,
      status: 'unknown',
      reason: 'Annual revenue not provided in capability statement.',
    }
  }

  const revenueMillions = annualRevenueUsd / 1_000_000
  const limit = standard.threshold_value // in millions

  if (revenueMillions <= limit) {
    const underMillions = limit - revenueMillions
    return {
      naics,
      standard,
      status: 'eligible',
      reason: `Annual revenue ($${revenueMillions.toFixed(1)}M) is under the ${standard.threshold_label} threshold.`,
      margin: `$${underMillions.toFixed(1)}M under threshold`,
    }
  } else {
    const overMillions = revenueMillions - limit
    return {
      naics,
      standard,
      status: 'ineligible',
      reason: `Annual revenue ($${revenueMillions.toFixed(1)}M) exceeds the ${standard.threshold_label} threshold.`,
      margin: `$${overMillions.toFixed(1)}M over threshold`,
    }
  }
}

/**
 * Convenience overload: accepts the raw capability statement fields directly.
 * Extracts the most recent revenue entry from the array automatically.
 */
export function checkSizeEligibilityFromCapStatement(
  naics: string,
  employeeCountRange: string | null | undefined,
  annualRevenue: AnnualRevenueEntry[] | null | undefined,
): SizeEligibility {
  const revenueUsd = mostRecentRevenue(annualRevenue)
  return checkSizeEligibility(naics, employeeCountRange ?? null, revenueUsd)
}
