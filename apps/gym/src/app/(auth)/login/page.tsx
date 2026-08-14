import { redirect } from 'next/navigation';

export default function LoginPage() {
  const returnUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://gym.roda.ink'
      : 'http://localhost:3002';

  const redirectUrl = `https://roda.ink/login?next=${encodeURIComponent(returnUrl)}`;
  console.log('[gym login] Redirecting to:', redirectUrl);
  redirect(redirectUrl);
}
