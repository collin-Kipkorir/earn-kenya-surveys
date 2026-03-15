import { useAuth } from '@/lib/auth-context';
import { getAvailableSurveys, getSurveys, Survey } from '@/lib/storage';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, ArrowRight, Crown, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SurveyListPage() {
  const { user } = useAuth();
  if (!user) return null;

  const allSurveys = getSurveys();
  const available = getAvailableSurveys(user);
  const limit = user.tier === 'gold' ? 25 : user.tier === 'premium' ? 10 : 3;
  const remaining = limit - user.surveysCompletedToday;
  const canTake = remaining > 0;

  const isLocked = (s: Survey) => {
    if (s.tier === 'premium' && user.tier === 'free') return true;
    if (s.tier === 'gold' && user.tier !== 'gold') return true;
    return false;
  };

  const isCompleted = (s: Survey) => user.completedSurveyIds.includes(s.id);
  const tierIcon = (tier: string) => tier === 'gold' ? Crown : tier === 'premium' ? Zap : Shield;

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Surveys</h1>
      <p className="text-sm text-muted-foreground mb-6">{remaining > 0 ? `${remaining} surveys remaining today` : 'Daily limit reached. Come back tomorrow!'}</p>

      <div className="space-y-3">
        {allSurveys.map((survey, i) => {
          const locked = isLocked(survey);
          const completed = isCompleted(survey);
          const TierIcon = tierIcon(survey.tier);

          return (
            <motion.div key={survey.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}>
              {locked ? (
                <div className="bg-card rounded-xl p-4 shadow-card opacity-60 relative overflow-hidden">
                  <div className="absolute inset-0 bg-muted/30 backdrop-blur-[1px] flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-1">
                      <Lock className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Upgrade to {survey.tier}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TierIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground capitalize">{survey.tier}</span>
                      </div>
                      <h3 className="font-semibold text-foreground">{survey.title}</h3>
                    </div>
                    <span className="font-bold text-primary">KSh {survey.reward}</span>
                  </div>
                </div>
              ) : completed ? (
                <div className="bg-card rounded-xl p-4 shadow-card opacity-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TierIcon className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary capitalize">{survey.tier}</span>
                      </div>
                      <h3 className="font-semibold text-foreground">{survey.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Done</span>
                    </div>
                  </div>
                </div>
              ) : (
                <Link to={canTake ? `/dashboard/survey/${survey.id}` : '#'} className={`block bg-card rounded-xl p-4 shadow-card hover:shadow-elevated transition-all ${!canTake ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TierIcon className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary capitalize">{survey.tier}</span>
                      </div>
                      <h3 className="font-semibold text-foreground">{survey.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">6 questions • ~3 min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">KSh {survey.reward}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
