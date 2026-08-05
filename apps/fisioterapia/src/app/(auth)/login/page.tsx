import { redirect } from 'next/navigation';

export default function LoginPage() {
  const returnUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://fisioterapia.roda.ink'
      : 'http://localhost:3001';

  const redirectUrl = `https://roda.ink/login?next=${encodeURIComponent(returnUrl)}`;
  console.log('[fisio login] Redirecting to:', redirectUrl);
  redirect(redirectUrl);
}
