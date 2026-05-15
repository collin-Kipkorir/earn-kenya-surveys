import { useAuth } from '@/lib/auth-context';
import { getSurveys, Survey } from '@/lib/storage';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  CheckCircle,
  ArrowRight,
  Crown,
  Zap,
  Shield,
  Clock3,
  CircleDollarSign,
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const tierStyles = {
  free: {
    pill: 'border-primary/15 bg-primary/10 text-primary',
    iconWrap: 'bg-primary/10 text-primary',
    panel: 'bg-primary/5',
    border: 'border-primary/10',
  },
  premium: {
    pill: 'border-secondary/15 bg-secondary/10 text-secondary',
    iconWrap: 'bg-secondary/10 text-secondary',
    panel: 'bg-secondary/5',
    border: 'border-secondary/10',
  },
  gold: {
    pill: 'border-accent/30 bg-accent/20 text-accent-foreground',
    iconWrap: 'bg-accent/25 text-accent-foreground',
    panel: 'bg-accent/10',
    border: 'border-accent/20',
  },
} satisfies Record<Survey['tier'], { pill: string; iconWrap: string; panel: string; border: string }>;

const metaLabels = {
  questions: 'Qs',
  time: 'Time',
  access: 'Tier',
  value: 'Value',
} as const;

function getEstimatedMinutes(survey: Survey) {
  return Math.max(2, Math.ceil(survey.questions.length / 2));
}

function getTierIcon(tier: Survey['tier']) {
  return tier === 'gold' ? Crown : tier === 'premium' ? Zap : Shield;
}

export default function SurveyListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const allSurveys = getSurveys();
  const shuffledSurveys = useMemo(() => shuffleArray(allSurveys), [allSurveys.length]);

  if (!user) return null;

  const limit = user.tier === 'gold' ? 25 : user.tier === 'premium' ? 10 : 3;
  const remaining = limit - user.surveysCompletedToday;
  const canTake = remaining > 0;

  const isLocked = (survey: Survey) => {
    if (survey.tier === 'premium' && user.tier === 'free') return true;
    if (survey.tier === 'gold' && user.tier !== 'gold') return true;
    return false;
  };

  const isCompleted = (survey: Survey) => user.completedSurveyIds.includes(survey.id);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-6 sm:px-5 lg:px-6">
      <div className="mb-6 lg:mb-8">
        <h1 className="mb-2 text-2xl font-display font-bold text-foreground sm:text-3xl">Surveys</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          {remaining > 0 ? `${remaining} surveys remaining today` : 'Daily limit reached. Come back tomorrow!'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shuffledSurveys.map((survey, i) => {
          const locked = isLocked(survey);
          const completed = isCompleted(survey);
          const TierIcon = getTierIcon(survey.tier);
          const styles = tierStyles[survey.tier];
          const questionCount = survey.questions.length;
          const estimatedMinutes = getEstimatedMinutes(survey);

          return (
            <motion.div
              key={survey.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              {locked ? (
                <div
                  onClick={() => navigate('/dashboard/upgrade')}
                  className={`relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:p-5 ${styles.border}`}
                >
                  <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px]" />
                  <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-muted/40" />
                  <div className="absolute inset-x-0 top-0 h-1 bg-muted/40" />

                  <div className="absolute inset-0 z-20 flex items-center justify-center px-5">
                    <div className="w-full max-w-xs rounded-2xl border border-border/70 bg-card/90 px-4 py-3 text-center shadow-card">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Lock className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Upgrade to unlock</p>
                      <p className="text-xs capitalize text-muted-foreground">{survey.tier} survey access</p>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-3 sm:gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm sm:h-14 sm:w-14 ${styles.iconWrap}`}>
                      <TierIcon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${styles.pill}`}
                          >
                            <TierIcon className="h-3.5 w-3.5" />
                            {survey.tier}
                          </div>
                          <h3 className="text-base font-display font-bold text-foreground sm:text-lg">{survey.title}</h3>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="block text-base font-extrabold text-foreground sm:text-lg">KSh {survey.reward}</span>
                          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Reward
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className={`rounded-xl border border-border/60 px-2.5 py-2 ${styles.panel}`}>
                          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
                            {metaLabels.questions}
                          </span>
                          <span className="text-sm font-semibold text-foreground">{questionCount}</span>
                        </div>
                        <div className={`rounded-xl border border-border/60 px-2.5 py-2 ${styles.panel}`}>
                          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
                            {metaLabels.time}
                          </span>
                          <span className="text-sm font-semibold text-foreground">~{estimatedMinutes} min</span>
                        </div>
                        <div className={`rounded-xl border border-border/60 px-2.5 py-2 ${styles.panel}`}>
                          <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
                            {metaLabels.access}
                          </span>
                          <span className="text-sm font-semibold capitalize text-foreground">{survey.tier}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : completed ? (
                <div className={`relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-4 shadow-card sm:p-5 ${styles.border}`}>
                  <div className="absolute inset-x-0 top-0 h-1 gradient-primary opacity-80" />

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-14 sm:w-14">
                      <CheckCircle className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                            <TierIcon className="h-3.5 w-3.5" />
                            {survey.tier}
                          </div>
                          <h3 className="text-base font-display font-bold text-foreground sm:text-lg">{survey.title}</h3>
                        </div>

                        <div className="self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Completed
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/5 px-3 py-3 sm:px-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Reward secured</p>
                          <p className="text-xs text-muted-foreground">
                            This survey is already in your completed list.
                          </p>
                        </div>
                        <span className="text-lg font-extrabold text-primary">KSh {survey.reward}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  to={canTake ? `/dashboard/survey/${survey.id}` : '#'}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-1 hover:shadow-elevated sm:p-5 ${styles.border} ${!canTake ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <div className="absolute inset-x-0 top-0 h-1 gradient-primary" />
                  <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/5 transition-transform duration-300 group-hover:scale-110" />

                  <div className="relative flex h-full items-start gap-3 sm:gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105 sm:h-14 sm:w-14 ${styles.iconWrap}`}
                    >
                      <TierIcon className="h-5 w-5" />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${styles.pill}`}
                          >
                            <TierIcon className="h-3.5 w-3.5" />
                            {survey.tier}
                          </div>
                          <h3 className="text-base font-display font-bold leading-tight text-foreground sm:text-lg">{survey.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Clean, quick survey with a fast reward once completed.
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="block text-lg font-extrabold text-foreground sm:text-xl">KSh {survey.reward}</span>
                          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Reward
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className={`rounded-xl border border-border/60 px-2.5 py-2 ${styles.panel}`}>
                          <div className="mb-1 flex items-center gap-1 text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="text-[10px] uppercase tracking-[0.12em] sm:text-[11px]">{metaLabels.questions}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{questionCount}</span>
                        </div>
                        <div className={`rounded-xl border border-border/60 px-2.5 py-2 ${styles.panel}`}>
                          <div className="mb-1 flex items-center gap-1 text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span className="text-[10px] uppercase tracking-[0.12em] sm:text-[11px]">{metaLabels.time}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">~{estimatedMinutes} min</span>
                        </div>
                        <div className={`rounded-xl border border-border/60 px-2.5 py-2 ${styles.panel}`}>
                          <div className="mb-1 flex items-center gap-1 text-muted-foreground">
                            <CircleDollarSign className="h-3.5 w-3.5" />
                            <span className="text-[10px] uppercase tracking-[0.12em] sm:text-[11px]">{metaLabels.value}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">High</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-1 flex-col justify-end">
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-3 py-3 sm:px-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">Ready to start</p>
                            <p className="truncate text-xs text-muted-foreground">Open survey and begin answering now.</p>
                          </div>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform duration-300 group-hover:translate-x-1">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
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
