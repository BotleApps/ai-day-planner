import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import SignInClient from './sign-in-client';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  if (session) redirect(callbackUrl || '/');
  return <SignInClient callbackUrl={callbackUrl} />;
}
