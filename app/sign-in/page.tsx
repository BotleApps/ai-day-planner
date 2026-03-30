import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import SignInClient from './sign-in-client';

export default async function SignInPage() {
  const session = await auth();
  if (session) redirect('/');
  return <SignInClient />;
}
