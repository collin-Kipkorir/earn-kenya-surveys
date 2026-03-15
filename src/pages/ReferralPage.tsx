import { useAuth } from '@/lib/auth-context';
import { Copy, Users, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralPage() {
  const { user } = useAuth();
  if (!user) return null;

  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  const copy = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: 'SurveyEarn Kenya', text: 'Join SurveyEarn Kenya and earn money by taking surveys!', url: referralLink });
    } else {
      copy();
    }
  };

  return (
    <div className="px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Invite Friends</h1>
      <p className="text-sm text-muted-foreground mb-6">Earn KSh 20 for every friend who registers and activates</p>

      <div className="gradient-hero rounded-2xl p-6 text-primary-foreground mb-6 text-center">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-90" />
        <p className="text-3xl font-display font-extrabold mb-1">KSh 20</p>
        <p className="opacity-80">per activated referral</p>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-card mb-4">
        <h3 className="font-display font-bold text-foreground mb-2">Your Referral Code</h3>
        <p className="text-2xl font-bold text-primary text-center py-3">{user.referralCode}</p>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-card mb-4">
        <h3 className="font-display font-bold text-foreground mb-2">Your Referral Link</h3>
        <input readOnly value={referralLink} className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-sm text-foreground mb-3 truncate" />
        <div className="flex gap-2">
          <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
            <Copy className="w-4 h-4" /> Copy Link
          </button>
          <button onClick={share} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-bold hover:opacity-90 transition-opacity">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-card">
        <h3 className="font-display font-bold text-foreground mb-3">How It Works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Share your referral link with friends</li>
          <li>Friend registers using your link</li>
          <li>Friend activates their account</li>
          <li>You receive KSh 20 bonus!</li>
        </ol>
      </div>
    </div>
  );
}
