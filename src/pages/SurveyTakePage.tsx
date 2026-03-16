import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSurveys, completeSurvey } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import AdBanner from '@/components/AdBanner';
import { useAdManager } from '@/hooks/useAdManager';

export default function SurveyTakePage() {
  const { id } = useParams<{ id: string }>();
  const survey = getSurveys().find(s => s.id === id);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textInput, setTextInput] = useState('');
  const [completed, setCompleted] = useState(false);
  const [reward, setReward] = useState(0);
  const { showAd, triggerAd, dismissAd } = useAdManager();

  if (!survey || !user) return null;

  const q = survey.questions[step];
  const total = survey.questions.length;

  const handleAnswer = (answer: string) => {
    const newAnswers = { ...answers, [q.id]: answer };
    setAnswers(newAnswers);
    setTextInput('');
    if (step < total - 1) {
      setStep(step + 1);
    } else {
      try {
        const r = completeSurvey(user.id, survey.id);
        setReward(r);
        setCompleted(true);
        refreshUser();
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        // Show ad after completing free tier surveys
        if (survey.tier === 'free') {
          setTimeout(() => triggerAd(), 2000);
        }
      } catch (err: any) {
        alert(err.message);
        navigate('/dashboard/surveys');
      }
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim().length < 2) return;
    handleAnswer(textInput.trim());
  };

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-3xl p-8 shadow-elevated text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Survey Complete!</h2>
          <p className="text-4xl font-display font-extrabold text-gradient mb-2">+KSh {reward}</p>
          <p className="text-muted-foreground mb-6">Reward added to your balance</p>
          <button onClick={() => navigate('/dashboard/surveys')} className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
            More Surveys
          </button>
        </motion.div>
        <AdBanner show={showAd} onDismiss={dismissAd} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <button onClick={() => navigate('/dashboard/surveys')} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-lg font-display font-bold text-foreground mb-1">{survey.title}</h1>

      {/* Progress */}
      <div className="flex gap-1.5 mb-6">
        {survey.questions.map((_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full transition-colors ${i <= step ? 'gradient-primary' : 'bg-muted'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} className="bg-card rounded-2xl p-6 shadow-card">
          <p className="text-xs text-muted-foreground mb-2">Question {step + 1} of {total}</p>
          <h2 className="text-lg font-display font-semibold text-foreground mb-5">{q.text}</h2>

          {q.type === 'multiple-choice' && q.options ? (
            <div className="space-y-2.5">
              {q.options.map(opt => (
                <button key={opt} onClick={() => handleAnswer(opt)} className="w-full text-left px-4 py-3.5 rounded-xl border-2 border-border bg-background text-foreground font-medium hover:border-primary hover:bg-primary/5 transition-all">
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Type your answer..." rows={3} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring outline-none resize-none mb-3" maxLength={500} />
              <button onClick={handleTextSubmit} disabled={textInput.trim().length < 2} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                {step === total - 1 ? 'Submit Survey' : 'Next'}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
