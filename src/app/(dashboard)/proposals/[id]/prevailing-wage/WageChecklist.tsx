'use client'

import { useState } from 'react'

interface ChecklistItem {
  id: string
  label: string
}

interface ChecklistGroup {
  title: string
  items: ChecklistItem[]
}

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    title: 'Before Submission',
    items: [
      { id: 'bs1', label: 'Obtain applicable wage determination from SAM.gov' },
      { id: 'bs2', label: 'Verify WD covers all planned trades/classifications' },
      { id: 'bs3', label: 'Confirm WD is current (check modification date)' },
      { id: 'bs4', label: 'Include WD number in price narrative / cost breakdown' },
    ],
  },
  {
    title: 'During Performance',
    items: [
      { id: 'dp1', label: 'Post WD at job site (29 CFR 5.5 requirement)' },
      { id: 'dp2', label: 'Submit weekly certified payrolls (Form WH-347)' },
      { id: 'dp3', label: 'Maintain payroll records for 3 years post-completion' },
      { id: 'dp4', label: 'Classify workers correctly (journeyman vs apprentice ratios)' },
    ],
  },
  {
    title: 'Proposal Language',
    items: [
      { id: 'pl1', label: 'Reference specific WD number in Technical Approach' },
      { id: 'pl2', label: 'Address Davis-Bacon compliance in Management Plan' },
      { id: 'pl3', label: 'Include certified payroll process in Quality Control Plan' },
    ],
  },
]

export default function WageChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const totalItems = CHECKLIST_GROUPS.reduce((sum, g) => sum + g.items.length, 0)
  const checkedCount = checked.size

  return (
    <div>
      {/* Progress summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 6, background: '#F0F2F5', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%`,
              background: '#00C48C',
              borderRadius: 3,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>
          {checkedCount} / {totalItems} complete
        </span>
      </div>

      {CHECKLIST_GROUPS.map(group => (
        <div key={group.title} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            {group.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.items.map(item => {
              const isChecked = checked.has(item.id)
              return (
                <label
                  key={item.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(item.id)}
                    style={{ marginTop: 2, accentColor: '#2F80FF', width: 15, height: 15, flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: isChecked ? '#94A3B8' : '#0F172A',
                      textDecoration: isChecked ? 'line-through' : 'none',
                      lineHeight: 1.5,
                    }}
                  >
                    {item.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
