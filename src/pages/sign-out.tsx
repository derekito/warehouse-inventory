import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function SignOut() {
  const router = useRouter();

  useEffect(() => {
    const handleSignOut = async () => {
      try {
        await signOut(auth);
        router.push('/login');
      } catch (error) {
        console.error('Error signing out:', error);
      }
    };

    handleSignOut();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-lg font-medium text-gray-900">Signing out...</h2>
        <p className="mt-2 text-sm text-gray-500">Please wait while we sign you out.</p>
      </div>
    </div>
  );
} 