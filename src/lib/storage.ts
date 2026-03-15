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
  updateUser(userId, { tier: newTier, dailySurveyLimit: limit });
  addTransaction({ userId, type: 'upgrade', amount: cost, status: 'completed', description: `Upgraded to ${newTier}` });
}

// Activation
export function activateAccount(userId: string) {
  updateUser(userId, { isActivated: true });
  addTransaction({ userId, type: 'activation', amount: 100, status: 'completed', description: 'Account activation' });
  // Process referral bonus
  const user = getUserById(userId)!;
  if (user.referredBy) processReferral(user.referredBy);
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
  if (getSurveys().length > 0) return;
  const surveys: Survey[] = [
    // Free tier
    { id: 'f1', title: 'Mobile Banking Habits', tier: 'free', reward: 5, questions: [
      { id: 'f1q1', text: 'Which mobile banking app do you use most?', type: 'multiple-choice', options: ['M-Pesa', 'KCB App', 'Equity App', 'Other'] },
      { id: 'f1q2', text: 'How often do you send money via mobile?', type: 'multiple-choice', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'] },
      { id: 'f1q3', text: 'What is your biggest concern with mobile money?', type: 'text' },
      { id: 'f1q4', text: 'Do you save money using your phone?', type: 'multiple-choice', options: ['Yes, regularly', 'Sometimes', 'No'] },
      { id: 'f1q5', text: 'How much do you spend on airtime monthly?', type: 'multiple-choice', options: ['Under KSh 500', 'KSh 500-1000', 'KSh 1000-2000', 'Over KSh 2000'] },
      { id: 'f1q6', text: 'Any suggestions for improving mobile banking?', type: 'text' },
    ]},
    { id: 'f2', title: 'Shopping Preferences', tier: 'free', reward: 10, questions: [
      { id: 'f2q1', text: 'Where do you prefer shopping?', type: 'multiple-choice', options: ['Online', 'Physical Stores', 'Both equally'] },
      { id: 'f2q2', text: 'Which online marketplace do you use most?', type: 'multiple-choice', options: ['Jumia', 'Kilimall', 'Jiji', 'Other'] },
      { id: 'f2q3', text: 'How much do you spend on groceries weekly?', type: 'multiple-choice', options: ['Under KSh 2000', 'KSh 2000-5000', 'KSh 5000-10000', 'Over KSh 10000'] },
      { id: 'f2q4', text: 'What influences your purchase decisions most?', type: 'multiple-choice', options: ['Price', 'Quality', 'Brand', 'Reviews'] },
      { id: 'f2q5', text: 'How often do you shop online?', type: 'multiple-choice', options: ['Weekly', 'Monthly', 'Rarely', 'Never'] },
      { id: 'f2q6', text: 'Describe your ideal shopping experience.', type: 'text' },
    ]},
    { id: 'f3', title: 'Social Media Usage', tier: 'free', reward: 15, questions: [
      { id: 'f3q1', text: 'Which social media platform do you use most?', type: 'multiple-choice', options: ['WhatsApp', 'Facebook', 'TikTok', 'Instagram'] },
      { id: 'f3q2', text: 'How many hours daily on social media?', type: 'multiple-choice', options: ['Less than 1', '1-3 hours', '3-5 hours', 'Over 5 hours'] },
      { id: 'f3q3', text: 'Do you follow brands on social media?', type: 'multiple-choice', options: ['Yes, many', 'A few', 'Not really'] },
      { id: 'f3q4', text: 'Have you bought something through a social media ad?', type: 'multiple-choice', options: ['Yes', 'No'] },
      { id: 'f3q5', text: 'What content do you enjoy most?', type: 'multiple-choice', options: ['Videos', 'Images', 'Stories', 'Text posts'] },
      { id: 'f3q6', text: 'What would make social media better for you?', type: 'text' },
    ]},
    // Premium
    { id: 'p1', title: 'Financial Planning Insights', tier: 'premium', reward: 30, questions: [
      { id: 'p1q1', text: 'Do you have a personal budget?', type: 'multiple-choice', options: ['Yes', 'No', 'Sometimes'] },
      { id: 'p1q2', text: 'What is your primary savings goal?', type: 'multiple-choice', options: ['Emergency fund', 'Education', 'Business', 'Investment'] },
      { id: 'p1q3', text: 'Do you invest in any financial products?', type: 'multiple-choice', options: ['Stocks', 'SACCOs', 'MMFs', 'None'] },
      { id: 'p1q4', text: 'How do you track your expenses?', type: 'text' },
      { id: 'p1q5', text: 'What financial service would help you most?', type: 'text' },
      { id: 'p1q6', text: 'Rate your financial literacy (1-5)', type: 'multiple-choice', options: ['1 - Very low', '2', '3', '4', '5 - Very high'] },
    ]},
    { id: 'p2', title: 'Health & Wellness Survey', tier: 'premium', reward: 40, questions: [
      { id: 'p2q1', text: 'Do you have health insurance?', type: 'multiple-choice', options: ['NHIF only', 'Private insurance', 'Both', 'None'] },
      { id: 'p2q2', text: 'How often do you exercise?', type: 'multiple-choice', options: ['Daily', 'Few times a week', 'Rarely', 'Never'] },
      { id: 'p2q3', text: 'Where do you seek medical care?', type: 'multiple-choice', options: ['Public hospital', 'Private hospital', 'Pharmacy', 'Traditional medicine'] },
      { id: 'p2q4', text: 'What health topic concerns you most?', type: 'text' },
      { id: 'p2q5', text: 'Would you use a telemedicine app?', type: 'multiple-choice', options: ['Yes', 'Maybe', 'No'] },
      { id: 'p2q6', text: 'Any feedback on healthcare in Kenya?', type: 'text' },
    ]},
    { id: 'p3', title: 'Education & Career', tier: 'premium', reward: 50, questions: [
      { id: 'p3q1', text: 'What is your highest education level?', type: 'multiple-choice', options: ['Secondary', 'Diploma', 'Degree', 'Postgraduate'] },
      { id: 'p3q2', text: 'Are you currently employed?', type: 'multiple-choice', options: ['Employed', 'Self-employed', 'Unemployed', 'Student'] },
      { id: 'p3q3', text: 'Would you take an online course?', type: 'multiple-choice', options: ['Yes', 'Maybe', 'No'] },
      { id: 'p3q4', text: 'What skills do you want to learn?', type: 'text' },
      { id: 'p3q5', text: 'How do you search for jobs?', type: 'multiple-choice', options: ['Online portals', 'Social media', 'Networking', 'Agencies'] },
      { id: 'p3q6', text: 'What would improve your career prospects?', type: 'text' },
    ]},
    // Gold
    { id: 'g1', title: 'Business & Entrepreneurship', tier: 'gold', reward: 100, questions: [
      { id: 'g1q1', text: 'Do you own or plan to start a business?', type: 'multiple-choice', options: ['Own one', 'Planning to', 'Not interested'] },
      { id: 'g1q2', text: 'What sector interests you most?', type: 'multiple-choice', options: ['Technology', 'Agriculture', 'Retail', 'Services'] },
      { id: 'g1q3', text: 'What is your biggest business challenge?', type: 'text' },
      { id: 'g1q4', text: 'How do you fund your business?', type: 'multiple-choice', options: ['Personal savings', 'Loans', 'Investors', 'Not applicable'] },
      { id: 'g1q5', text: 'Do you use digital tools for business?', type: 'multiple-choice', options: ['Yes, extensively', 'Some', 'No'] },
      { id: 'g1q6', text: 'What support would help entrepreneurs?', type: 'text' },
    ]},
    { id: 'g2', title: 'Technology & Innovation', tier: 'gold', reward: 150, questions: [
      { id: 'g2q1', text: 'What type of phone do you use?', type: 'multiple-choice', options: ['Android', 'iPhone', 'Feature phone'] },
      { id: 'g2q2', text: 'How much data do you buy monthly?', type: 'multiple-choice', options: ['Under 1GB', '1-5GB', '5-10GB', 'Over 10GB'] },
      { id: 'g2q3', text: 'What apps can\'t you live without?', type: 'text' },
      { id: 'g2q4', text: 'Would you try a new Kenyan-made app?', type: 'multiple-choice', options: ['Definitely', 'Maybe', 'Unlikely'] },
      { id: 'g2q5', text: 'What tech problem needs solving in Kenya?', type: 'text' },
      { id: 'g2q6', text: 'How do you feel about AI technology?', type: 'multiple-choice', options: ['Excited', 'Curious', 'Worried', 'Indifferent'] },
    ]},
    { id: 'g3', title: 'Lifestyle & Entertainment', tier: 'gold', reward: 200, questions: [
      { id: 'g3q1', text: 'How do you spend your free time?', type: 'multiple-choice', options: ['Sports', 'Gaming', 'Reading', 'Socializing'] },
      { id: 'g3q2', text: 'Which streaming service do you use?', type: 'multiple-choice', options: ['Netflix', 'YouTube', 'Showmax', 'None'] },
      { id: 'g3q3', text: 'How much do you spend on entertainment monthly?', type: 'multiple-choice', options: ['Under KSh 1000', 'KSh 1000-3000', 'KSh 3000-5000', 'Over KSh 5000'] },
      { id: 'g3q4', text: 'What event would you attend?', type: 'text' },
      { id: 'g3q5', text: 'Do you travel within Kenya?', type: 'multiple-choice', options: ['Frequently', 'Occasionally', 'Rarely'] },
      { id: 'g3q6', text: 'What\'s your dream vacation destination?', type: 'text' },
    ]},
  ];
  setSurveys(surveys);
}
