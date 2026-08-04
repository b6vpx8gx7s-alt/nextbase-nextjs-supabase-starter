import { redirect } from 'next/navigation';

export default function LoginPage() {
  const returnUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://fisioterapia.roda.ink'
      : 'http://localhost:3001';

  redirect(`https://roda.ink/login?returnUrl=${encodeURIComponent(returnUrl)}`);
}
