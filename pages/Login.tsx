
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, KeyRound } from 'lucide-react';

const Login: React.FC = () => {
  const { login, users } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length < 3) return;

    setLoading(true);
    const success = await login(code);
    setLoading(false);

    if (success) {
      // Determine redirect path
      const user = users.find(u => u.code.toLowerCase() === code.toLowerCase());
      const targetPath = user?.defaultPage || '/';
      navigate(targetPath);
    } else {
      setError('Invalid Access Code. Please try again.');
      setCode('');
    }
  };

  return (
    <div className="min-h-screen bg-[#eff2e7] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-8 pb-6 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-[#95a77c]/20 text-[#95a77c] rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your access code to continue</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                Access Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                   <KeyRound size={20} />
                </div>
                <input 
                  type="password"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#95a77c] focus:outline-none text-lg tracking-widest transition-all"
                  placeholder="Enter code"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-sm text-center font-medium animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 3}
              className="w-full h-14 rounded-xl bg-[#95a77c] hover:bg-[#85966d] active:bg-[#75855e] text-white font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95"
            >
              {loading ? (
                <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
