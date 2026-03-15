import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUser, setCurrentUserId, seedSurveys } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const schema = z.object({
  name: z.string().trim().min(2, 'Name too short').max(100),
  email: z.string().trim().email('Invalid email').max(255),
  phone: z.string().trim().regex(/^(07|01|\+254)\d{8,9}$/, 'Invalid Kenyan phone number'),
  password: z.string().min(6, 'Minimum 6 characters').max(100),
});

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || '';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', referralCode: ref });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = schema.safeParse(form);
    if (!result.success) { setError(result.error.errors[0].message); return; }
    setLoading(true);
    try {
      seedSurveys();
      const user = createUser({ name: form.name, email: form.email, phone: form.phone, password: form.password, referredBy: form.referralCode || undefined });
      setCurrentUserId(user.id);
      refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container max-w-md mx-auto flex-1 flex flex-col justify-center py-8 px-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl font-display font-bold mb-2">Create Account</h1>
        <p className="text-muted-foreground mb-8">Start earning with SurveyEarn Kenya</p>

        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Kamau" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all" required />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Phone Number</label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0712345678" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all" required />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all" required />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all pr-12" required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Referral Code <span className="text-muted-foreground">(optional)</span></label>
            <input type="text" value={form.referralCode} onChange={e => setForm({ ...form, referralCode: e.target.value })} placeholder="ABC123" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Creating...' : 'Register Now'}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/login" className="text-primary font-semibold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
