import { redirect } from 'next/navigation';

export default function LoginPage() {
  const returnUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://nutrition.roda.ink'
      : 'http://localhost:3000';

  redirect(`https://roda.ink/login?next=${encodeURIComponent(returnUrl)}`);
}
