import type { ReactNode } from 'react'
import Script from 'next/script'

export const metadata = { title: 'GovTool Writer' }

export default function AddinLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0B0B0D', color: '#F5F5F7', fontFamily: "'Inter', system-ui, sans-serif", height: '100vh', overflow: 'hidden' }}>
        <Script
          src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
