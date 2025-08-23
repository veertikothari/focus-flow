import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isResetMode, setIsResetMode] = useState(false); // 👈 for switching views
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');

    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);

      (async () => {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', savedEmail));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();

            if (userData.password === savedPassword) {
              localStorage.setItem('userEmail', savedEmail);
              localStorage.setItem('name', userData.name);
              const role = userData.role?.toLowerCase();

              if (role === 'office assistant' || role === 'founder') {
                navigate('/admindashboard');
              } else {
                navigate('/userdashboard');
              }
            }
          }
        } catch (err) {
          console.error('Auto-login failed:', err);
        }
      })();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (isResetMode) {
          // Reset password logic
          const docRef = doc(db, 'users', userDoc.id);
          await updateDoc(docRef, { password });
          setError('Password reset successful! Please log in.');
          setIsResetMode(false);
          setPassword('');
          return;
        }

        // Normal login logic
        if (userData.password === password) {
          const role = userData.role?.toLowerCase();
          localStorage.setItem('userEmail', email);
          localStorage.setItem('name', userData.name);

          if (rememberMe) {
            localStorage.setItem('rememberedEmail', email);
            localStorage.setItem('rememberedPassword', password);
          } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberedPassword');
          }

          if (role === 'office assistant' || role === 'founder') {
            navigate('/admindashboard');
          } else {
            navigate('/userdashboard');
          }
        } else {
          setError('Incorrect password!');
        }
      } else {
        setError('No user found with this email!');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-sm">
        <h1 className="text-3xl font-semibold text-center text-blue-600 mb-6">
          Focus Flow
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-lg font-medium text-gray-700">
              Email:
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-lg font-medium text-gray-700">
              {isResetMode ? 'New Password:' : 'Password:'}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isResetMode ? 'Enter new password' : 'Enter your password'}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {!isResetMode && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
                Remember Me
              </label>
            </div>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
          >
            {isResetMode ? 'Reset Password' : 'Login'}
          </button>

          <p
            className="text-sm text-blue-500 text-center cursor-pointer hover:underline"
            onClick={() => {
              setIsResetMode((prev) => !prev);
              setError('');
            }}
          >
            {isResetMode ? 'Back to Login' : 'Forgot Password?'}
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
