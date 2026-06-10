// ABOUTME: Login page — shows a Google sign-in button and handles the credential exchange.
// ABOUTME: On success, stores the app JWT and redirects to the dashboard.
import { GoogleLogin } from '@react-oauth/google';
import { Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSuccess(credentialResponse) {
    try {
      await login(credentialResponse.credential);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Login failed', err);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3">
          <Leaf size={36} className="text-green-600" />
          <h1 className="text-3xl font-bold text-green-900">PlantCare</h1>
        </div>
        <p className="text-gray-500 text-center text-sm">
          Sign in to manage your plants
        </p>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => console.error('Google sign-in error')}
          useOneTap
        />
      </div>
    </div>
  );
}
