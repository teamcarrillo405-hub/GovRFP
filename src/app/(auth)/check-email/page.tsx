export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h1>
        <p className="text-gray-600 mb-6">
          We sent you a confirmation link. Click the link to activate your account.
        </p>
        <p className="text-sm text-gray-500">
          Did not receive the email? Check your spam folder or{' '}
          <a href="/signup" className="text-blue-600 hover:text-blue-700">
            try signing up again
          </a>
          .
        </p>
      </div>
    </div>
  )
}
