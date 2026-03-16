// LocalStorage database layer for SurveyEarn Kenya

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  tier: 'free' | 'premium' | 'gold';
  balance: number;
  referralCode: string;
  referredBy: string | null;
  isActivated: boolean;
  surveysCompletedToday: number;
  dailySurveyLimit: number;
  totalEarnings: number;
  onboardingCompleted: boolean;
  completedSurveyIds: string[];
  lastSurveyReset: string;
  createdAt: string;
}

export interface Survey {
  id: string;
  title: string;
  tier: 'free' | 'premium' | 'gold';
  reward: number;
  questions: SurveyQuestion[];
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'text' | 'multiple-choice';
  options?: string[];
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'surveyReward' | 'referralBonus' | 'upgrade' | 'withdrawal' | 'activation' | 'onboarding';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  date: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
const generateReferralCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Simple hash - NOT cryptographically secure, just obfuscation for localStorage
export const hashPassword = (pw: string): string => {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const char = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
};

function getItem<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Users
export function getUsers(): User[] { return getItem('surveyearn_users', []); }
export function setUsers(users: User[]) { setItem('surveyearn_users', users); }

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function createUser(data: { name: string; email: string; phone: string; password: string; referredBy?: string }): User {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
    throw new Error('Email already registered');
  }
  const user: User = {
    id: generateId(),
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: hashPassword(data.password),
    tier: 'free',
    balance: 0,
    referralCode: generateReferralCode(),
    referredBy: data.referredBy || null,
    isActivated: false,
    surveysCompletedToday: 0,
    dailySurveyLimit: 3,
    totalEarnings: 0,
    onboardingCompleted: false,
    completedSurveyIds: [],
    lastSurveyReset: new Date().toDateString(),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  setUsers(users);
  return user;
}

export function updateUser(id: string, updates: Partial<User>): User {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User not found');
  users[idx] = { ...users[idx], ...updates };
  setUsers(users);
  return users[idx];
}

export function loginUser(email: string, password: string): User {
  const user = getUserByEmail(email);
  if (!user || user.password !== hashPassword(password)) {
    throw new Error('Invalid email or password');
  }
  setCurrentUserId(user.id);
  checkDailyReset(user.id);
  return user;
}

// Session
export function setCurrentUserId(id: string | null) {
  if (id) localStorage.setItem('surveyearn_current_user', id);
  else localStorage.removeItem('surveyearn_current_user');
}

export function getCurrentUserId(): string | null {
  return localStorage.getItem('surveyearn_current_user');
}

export function getCurrentUser(): User | undefined {
  const id = getCurrentUserId();
  return id ? getUserById(id) : undefined;
}

// Daily reset
export function checkDailyReset(userId: string) {
  const user = getUserById(userId);
  if (!user) return;
  const today = new Date().toDateString();
  if (user.lastSurveyReset !== today) {
    updateUser(userId, { surveysCompletedToday: 0, lastSurveyReset: today });
  }
}

// Surveys
export function getSurveys(): Survey[] { return getItem('surveyearn_surveys', []); }
export function setSurveys(surveys: Survey[]) { setItem('surveyearn_surveys', surveys); }

export function getAvailableSurveys(user: User): Survey[] {
  const surveys = getSurveys();
  return surveys.filter(s => {
    if (user.completedSurveyIds.includes(s.id)) return false;
    if (s.tier === 'free') return true;
    if (s.tier === 'premium') return user.tier === 'premium' || user.tier === 'gold';
    if (s.tier === 'gold') return user.tier === 'gold';
    return false;
  });
}

export function completeSurvey(userId: string, surveyId: string): number {
  const user = getUserById(userId)!;
  const survey = getSurveys().find(s => s.id === surveyId)!;
  const limit = user.tier === 'gold' ? 25 : user.tier === 'premium' ? 10 : 3;
  if (user.surveysCompletedToday >= limit) throw new Error('Daily survey limit reached');
  if (user.completedSurveyIds.includes(surveyId)) throw new Error('Survey already completed');

  updateUser(userId, {
    balance: user.balance + survey.reward,
    totalEarnings: user.totalEarnings + survey.reward,
    surveysCompletedToday: user.surveysCompletedToday + 1,
    completedSurveyIds: [...user.completedSurveyIds, surveyId],
  });
  addTransaction({ userId, type: 'surveyReward', amount: survey.reward, status: 'completed', description: `Completed: ${survey.title}` });
  return survey.reward;
}

// Transactions
export function getTransactions(): Transaction[] { return getItem('surveyearn_transactions', []); }

export function getUserTransactions(userId: string): Transaction[] {
  return getTransactions().filter(t => t.userId === userId);
}

export function addTransaction(data: Omit<Transaction, 'id' | 'date'>): Transaction {
  const txns = getTransactions();
  const t: Transaction = { ...data, id: generateId(), date: new Date().toISOString() };
  txns.push(t);
  setItem('surveyearn_transactions', txns);
  return t;
}

// Referral
export function processReferral(referrerCode: string) {
  const users = getUsers();
  const referrer = users.find(u => u.referralCode === referrerCode);
  if (referrer) {
    updateUser(referrer.id, { balance: referrer.balance + 20, totalEarnings: referrer.totalEarnings + 20 });
    addTransaction({ userId: referrer.id, type: 'referralBonus', amount: 20, status: 'completed', description: 'Referral bonus' });
  }
}

// Tier upgrade
export function upgradeTier(userId: string, newTier: 'premium' | 'gold') {
  const user = getUserById(userId)!;
  const cost = newTier === 'premium' ? 100 : 150;
  const limit = newTier === 'premium' ? 10 : 25;
  // Fee paid via STK push, NOT deducted from balance
  updateUser(userId, { tier: newTier, dailySurveyLimit: limit, surveysCompletedToday: 0 });
  addTransaction({ userId, type: 'upgrade', amount: cost, status: 'completed', description: `Upgraded to ${newTier} (paid via M-Pesa)` });
}

// Activation
export function activateAccount(userId: string) {
  const user = getUserById(userId)!;
  // Activation fee (KSh 100) paid via STK push is ADDED to balance as a bonus
  updateUser(userId, { isActivated: true, balance: user.balance + 100, totalEarnings: user.totalEarnings + 100 });
  addTransaction({ userId, type: 'activation', amount: 100, status: 'completed', description: 'Account activation — KSh 100 bonus added to balance' });
  // Process referral bonus
  const updatedUser = getUserById(userId)!;
  if (updatedUser.referredBy) processReferral(updatedUser.referredBy);
}

// Withdrawal
export function requestWithdrawal(userId: string, amount: number, phone: string) {
  const user = getUserById(userId)!;
  if (!user.isActivated) throw new Error('Account not activated');
  if (amount < 5000) throw new Error('Minimum withdrawal is KSh 5,000');
  if (user.balance < amount) throw new Error('Insufficient balance');
  updateUser(userId, { balance: user.balance - amount });
  addTransaction({ userId, type: 'withdrawal', amount, status: 'pending', description: `Withdrawal to ${phone}` });
}

// Onboarding
export function completeOnboarding(userId: string) {
  const user = getUserById(userId)!;
  updateUser(userId, { onboardingCompleted: true, balance: user.balance + 615, totalEarnings: user.totalEarnings + 615 });
  addTransaction({ userId, type: 'onboarding', amount: 615, status: 'completed', description: 'Onboarding bonus' });
}

// Seed surveys
export function seedSurveys() {
  if (getSurveys().length >= 60) return;

  const makeQuestions = (prefix: string, topic: string): SurveyQuestion[] => [
    { id: `${prefix}q1`, text: `What is your experience with ${topic}?`, type: 'multiple-choice', options: ['Very familiar', 'Somewhat familiar', 'Not familiar', 'Never heard of it'] },
    { id: `${prefix}q2`, text: `How often do you engage with ${topic}?`, type: 'multiple-choice', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'] },
    { id: `${prefix}q3`, text: `What do you like most about ${topic}?`, type: 'text' },
    { id: `${prefix}q4`, text: `Rate your satisfaction with ${topic} (1-5)`, type: 'multiple-choice', options: ['1 - Very low', '2', '3', '4', '5 - Very high'] },
    { id: `${prefix}q5`, text: `Would you recommend ${topic} to a friend?`, type: 'multiple-choice', options: ['Definitely', 'Probably', 'Not sure', 'No'] },
    { id: `${prefix}q6`, text: `Any suggestions to improve ${topic}?`, type: 'text' },
  ];

  const freeTopics = [
    { title: 'Mobile Banking Habits', reward: 5 },
    { title: 'Shopping Preferences', reward: 10 },
    { title: 'Social Media Usage', reward: 15 },
    { title: 'Food & Beverage Choices', reward: 5 },
    { title: 'Public Transport Experience', reward: 10 },
    { title: 'Mobile Data Usage', reward: 15 },
    { title: 'Entertainment Preferences', reward: 5 },
    { title: 'Community Safety Feedback', reward: 10 },
    { title: 'Water & Sanitation Access', reward: 15 },
    { title: 'Clothing & Fashion Trends', reward: 5 },
    { title: 'Electricity & Energy Use', reward: 10 },
    { title: 'News & Media Consumption', reward: 15 },
    { title: 'Fitness & Wellness Habits', reward: 5 },
    { title: 'Pet Ownership Survey', reward: 10 },
    { title: 'Religious & Cultural Practices', reward: 15 },
    { title: 'Savings & Budgeting', reward: 5 },
    { title: 'Cooking & Recipes', reward: 10 },
    { title: 'Neighbourhood Satisfaction', reward: 15 },
    { title: 'Sports Interests', reward: 5 },
    { title: 'Environmental Awareness', reward: 10 },
  ];

  const premiumTopics = [
    { title: 'Financial Planning Insights', reward: 30 },
    { title: 'Health & Wellness Survey', reward: 40 },
    { title: 'Education & Career', reward: 50 },
    { title: 'Insurance Preferences', reward: 30 },
    { title: 'Digital Marketing Feedback', reward: 40 },
    { title: 'E-Commerce Experience', reward: 50 },
    { title: 'Workplace Culture', reward: 30 },
    { title: 'Travel & Tourism', reward: 40 },
    { title: 'Parenting & Childcare', reward: 50 },
    { title: 'Real Estate Interests', reward: 30 },
    { title: 'Automotive Preferences', reward: 40 },
    { title: 'Government Services', reward: 50 },
    { title: 'Banking Products Review', reward: 30 },
    { title: 'Online Learning Habits', reward: 40 },
    { title: 'Telecommunications Feedback', reward: 50 },
    { title: 'Charity & Volunteering', reward: 30 },
    { title: 'Agriculture & Farming', reward: 40 },
    { title: 'Beauty & Personal Care', reward: 50 },
    { title: 'Mental Health Awareness', reward: 30 },
    { title: 'Smart Home Technology', reward: 40 },
  ];

  const goldTopics = [
    { title: 'Business & Entrepreneurship', reward: 100 },
    { title: 'Technology & Innovation', reward: 150 },
    { title: 'Lifestyle & Entertainment', reward: 200 },
    { title: 'Investment Opportunities', reward: 100 },
    { title: 'Luxury Brands Survey', reward: 150 },
    { title: 'International Trade', reward: 200 },
    { title: 'AI & Future Tech', reward: 100 },
    { title: 'Corporate Leadership', reward: 150 },
    { title: 'Startup Ecosystem', reward: 200 },
    { title: 'Cryptocurrency Adoption', reward: 100 },
    { title: 'High-End Fashion', reward: 150 },
    { title: 'Global Travel Habits', reward: 200 },
    { title: 'Executive Wellness', reward: 100 },
    { title: 'Wealth Management', reward: 150 },
    { title: 'Premium Dining Experience', reward: 200 },
    { title: 'Private Education Review', reward: 100 },
    { title: 'Luxury Automotive', reward: 150 },
    { title: 'Estate Planning', reward: 200 },
    { title: 'Venture Capital Insights', reward: 100 },
    { title: 'Philanthropy & Impact', reward: 150 },
  ];

  const surveys: Survey[] = [
    ...freeTopics.map((t, i) => ({ id: `f${i+1}`, title: t.title, tier: 'free' as const, reward: t.reward, questions: makeQuestions(`f${i+1}`, t.title) })),
    ...premiumTopics.map((t, i) => ({ id: `p${i+1}`, title: t.title, tier: 'premium' as const, reward: t.reward, questions: makeQuestions(`p${i+1}`, t.title) })),
    ...goldTopics.map((t, i) => ({ id: `g${i+1}`, title: t.title, tier: 'gold' as const, reward: t.reward, questions: makeQuestions(`g${i+1}`, t.title) })),
  ];
  setSurveys(surveys);
}
