import { motion } from 'framer-motion';
import heroImg from '@/assets/hero-illustration.png';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Users, Smartphone, Wallet, Star } from 'lucide-react';
import { getCurrentUser } from '@/lib/storage';

const steps = [
  { icon: Users, label: 'Register Free', desc: 'Create your account in seconds' },
  { icon: CheckCircle, label: 'Complete Surveys', desc: 'Answer simple questions' },
  { icon: Wallet, label: 'Earn Cash', desc: 'Get rewarded instantly' },
  { icon: Smartphone, label: 'Withdraw via M-Pesa', desc: 'Cash out anytime' },
];

const tiers = [
  { name: 'Free', surveys: '3 surveys/day', rewards: 'KSh 5 – 15 per survey', color: 'bg-muted', border: 'border-border' },
  { name: 'Premium', surveys: '10 surveys/day', rewards: 'KSh 30 – 50 per survey', color: 'gradient-primary', border: 'border-primary', badge: 'KSh 1' },
  { name: 'Gold', surveys: '25 surveys/day', rewards: 'KSh 100 – 200 per survey', color: 'gradient-gold', border: 'border-accent', badge: 'KSh 2' },
];

const testimonials = [
  { name: 'Brian K.', location: 'Nairobi', text: 'Made KSh 6,200 in 3 weeks! This is legit.', rating: 5 },
  { name: 'Akinyi M.', location: 'Kisumu', text: 'Easy surveys, fast M-Pesa withdrawals. Love it!', rating: 5 },
  { name: 'James O.', location: 'Mombasa', text: 'Upgraded to Gold and now I earn KSh 15,000+ monthly.', rating: 5 },
];

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };

export default function LandingPage() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const currentUser = getCurrentUser();

  if (currentUser && currentUser.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <span className="text-xl font-display font-bold text-gradient">SurveyEarn</span>
          <div className="flex gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-medium rounded-lg text-foreground hover:bg-muted transition-colors">Login</Link>
            <Link to={ref ? `/register?ref=${ref}` : '/register'} className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-primary-foreground hover:opacity-90 transition-opacity">Register</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Star className="w-4 h-4" /> Trusted by 10,000+ Kenyans
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold leading-tight mb-4">
              Earn Up To{' '}
              <span className="text-gradient">KSh 20,000</span>{' '}
              Monthly Answering Simple Surveys
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Join thousands of Kenyan youths earning money by sharing their opinions on products and services.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to={ref ? `/register?ref=${ref}` : '/register'} className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold rounded-xl gradient-primary text-primary-foreground shadow-glow animate-pulse-glow hover:opacity-90 transition-opacity">
                Register Now <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold rounded-xl border-2 border-primary text-primary hover:bg-primary/5 transition-colors">
                Login
              </Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.6 }} className="flex justify-center">
            <img src={heroImg} alt="Earn money with surveys on your phone" className="w-72 md:w-96 animate-float" />
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-muted/50">
        <div className="container">
          <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-3xl md:text-4xl font-display font-bold text-center mb-12">
            How It Works
          </motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {steps.map((step, i) => (
              <motion.div key={step.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: i * 0.15, duration: 0.5 } } }}
                className="relative bg-card rounded-2xl p-6 shadow-card text-center group hover:shadow-elevated transition-shadow">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <step.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <span className="absolute top-3 left-3 text-xs font-bold text-muted-foreground">{i + 1}</span>
                <h3 className="font-display font-bold text-foreground mb-1">{step.label}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings Preview */}
      <section className="py-16 container">
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-3xl md:text-4xl font-display font-bold text-center mb-4">
          Choose Your Earning Tier
        </motion.h2>
        <p className="text-center text-muted-foreground mb-12">Unlock higher earnings as you upgrade</p>
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier, i) => (
            <motion.div key={tier.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: i * 0.15, duration: 0.5 } } }}
              className={`relative rounded-2xl border-2 ${tier.border} bg-card p-8 shadow-card hover:shadow-elevated transition-all`}>
              {tier.badge && <span className="absolute -top-3 right-4 px-3 py-1 text-xs font-bold rounded-full gradient-primary text-primary-foreground">{tier.badge}</span>}
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">{tier.name}</h3>
              <p className="text-muted-foreground mb-4">{tier.surveys}</p>
              <p className="text-xl font-bold text-primary">{tier.rewards}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-muted/50">
        <div className="container">
          <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-3xl md:text-4xl font-display font-bold text-center mb-12">
            What Kenyans Are Saying
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { delay: i * 0.15, duration: 0.5 } } }}
                className="bg-card rounded-2xl p-6 shadow-card">
                <div className="flex gap-1 mb-3">{Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 fill-accent text-accent" />)}</div>
                <p className="text-foreground mb-4">"{t.text}"</p>
                <p className="text-sm font-semibold text-foreground">— {t.name}</p>
                <p className="text-xs text-muted-foreground">{t.location}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Referral */}
      <section className="py-16 container">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          className="gradient-hero rounded-3xl p-8 md:p-12 text-center text-primary-foreground">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Invite Friends & Earn More</h2>
          <p className="text-lg opacity-90 mb-6">Earn KSh 20 for every friend who registers and activates their account.</p>
          <Link to={ref ? `/register?ref=${ref}` : '/register'} className="inline-flex items-center gap-2 px-8 py-4 text-lg font-bold rounded-xl bg-card text-foreground hover:bg-card/90 transition-colors">
            Start Earning Now <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2026 SurveyEarn Kenya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
