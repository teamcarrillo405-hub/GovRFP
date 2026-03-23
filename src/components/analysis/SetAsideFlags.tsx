import type { SetAsideFlag } from '@/lib/analysis/types'

interface Props {
  setAsidesDetected: string[]
  setAsideFlags: SetAsideFlag[]
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  )
}

export default function SetAsideFlags({ setAsidesDetected, setAsideFlags }: Props) {
  if (setAsidesDetected.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
        No set-aside preferences detected
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-4">
      {setAsideFlags.map((flag) => (
        <div key={flag.program} className="flex flex-col items-center gap-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
              flag.is_match
                ? 'bg-green-100 text-green-800 border-green-300'
                : flag.detected_in_rfp
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
            }`}
          >
            {flag.is_match ? <CheckIcon /> : flag.detected_in_rfp ? <AlertIcon /> : null}
            {flag.program}
          </span>
          <span className="text-xs text-gray-500">
            {flag.contractor_eligible ? 'Eligible' : 'Not eligible'}
          </span>
        </div>
      ))}
    </div>
  )
}
