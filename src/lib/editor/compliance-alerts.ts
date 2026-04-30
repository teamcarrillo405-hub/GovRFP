import type { AnalysisRequirement, ComplianceMatrixRow } from '@/lib/analysis/types'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface ComplianceAlert {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  requirementId?: string
  section?: string
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…'
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export function generateComplianceAlerts(
  requirements: AnalysisRequirement[],
  matrix: ComplianceMatrixRow[],
  sectionWordCounts: Record<string, number>,
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = []

  // Build a quick lookup: requirementId → coverage_status
  const coverageMap = new Map<string, ComplianceMatrixRow['coverage_status']>()
  for (const row of matrix) {
    coverageMap.set(row.requirement_id, row.coverage_status)
  }

  let infoCount = 0

  for (const req of requirements) {
    const status = coverageMap.get(req.id)

    if (req.classification === 'mandatory' && status === 'unaddressed') {
      // 1. Critical — unaddressed mandatory
      alerts.push({
        id: `critical-${req.id}`,
        severity: 'critical',
        title: 'Mandatory requirement not addressed',
        detail: `${truncate(req.text, 120)} [${req.proposal_topic}]`,
        requirementId: req.id,
      })
    } else if (req.classification === 'mandatory' && status === 'partial') {
      // 2. Warning — partially addressed mandatory
      alerts.push({
        id: `warning-partial-${req.id}`,
        severity: 'warning',
        title: 'Mandatory requirement partially covered',
        detail: truncate(req.text, 100),
        requirementId: req.id,
      })
    } else if (req.classification === 'desired' && status === 'unaddressed') {
      // 4. Info — unaddressed desired (cap at 3)
      if (infoCount < 3) {
        alerts.push({
          id: `info-${req.id}`,
          severity: 'info',
          title: 'Desired requirement not addressed',
          detail: truncate(req.text, 100),
          requirementId: req.id,
        })
        infoCount++
      }
    }
  }

  // 3. Warning — thin sections (word count > 0 but < 150)
  for (const [sectionName, count] of Object.entries(sectionWordCounts)) {
    if (count > 0 && count < 150) {
      alerts.push({
        id: `warning-thin-${sectionName.replace(/\s+/g, '-').toLowerCase()}`,
        severity: 'warning',
        title: `Section may be too thin: ${sectionName}`,
        detail: `Only ${count} words. Evaluators expect substantial coverage.`,
        section: sectionName,
      })
    }
  }

  // Sort: critical → warning → info
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return alerts
}
