import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeOnboarding } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

const questions = [
  { id: 1, text: 'What is your age group?', type: 'multiple-choice' as const, options: ['18-24', '25-34', '35-44', '45+'] },
  { id: 2, text: 'What is your employment status?', type: 'multiple-choice' as const, options: ['Employed', 'Self-employed', 'Student', 'Unemployed'] },
  { id: 3, text: 'What are your shopping habits?', type: 'multiple-choice' as const, options: ['Shop online frequently', 'Prefer physical stores', 'Mix of both', 'Rarely shop'] },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleAnswer = (answer: string) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding(user!.id);
      refreshUser();
      setCompleted(true);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-3xl p-8 shadow-elevated text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Welcome Bonus!</h2>
          <p className="text-4xl font-display font-extrabold text-gradient mb-2">KSh 615</p>
          <p className="text-muted-foreground mb-6">Has been added to your account</p>
          <button onClick={() => navigate('/dashboard')} className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  const q = questions[step];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8">
          {questions.map((_, i) => (
            <div key={i} className={`flex-1 h-2 rounded-full transition-colors ${i <= step ? 'gradient-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="bg-card rounded-3xl p-8 shadow-elevated">
            <p className="text-sm text-muted-foreground mb-2">Question {step + 1} of {questions.length}</p>
            <h2 className="text-xl font-display font-bold text-foreground mb-6">{q.text}</h2>
            <div className="space-y-3">
              {q.options.map(opt => (
                <button key={opt} onClick={() => handleAnswer(opt)} className="w-full text-left px-5 py-4 rounded-xl border-2 border-border bg-background text-foreground font-medium hover:border-primary hover:bg-primary/5 transition-all">
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
