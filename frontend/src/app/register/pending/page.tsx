import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-bg">
      <div className="w-full max-w-md rounded-xl border border-border bg-card-bg p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fef3c7]">
          <svg className="h-8 w-8 text-[#92400e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-text-primary">Under HR Review</h1>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
          Your profile has been submitted and is under HR review.
          You will receive an email once your account is activated.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
