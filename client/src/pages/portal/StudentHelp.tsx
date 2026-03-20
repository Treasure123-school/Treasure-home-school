import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  HelpCircle, ChevronDown, Mail, Phone, MessageCircle,
  BookOpen, ExternalLink, Send, CheckCircle2, AlertCircle,
  Shield, CreditCard, LogIn, Video, Lock, RotateCcw, User,
  Zap,
} from 'lucide-react';

// ── FAQ Data ───────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    category: 'Exams',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-blue-600 dark:text-blue-400',
    questions: [
      {
        q: 'How do I take an exam?',
        a: 'Go to Academic → Exams / Tests in the sidebar. Click on an available exam and press "Start Exam". Make sure you have a stable internet connection before starting. The timer will begin automatically. Answer all questions and click "Submit" when done.',
      },
      {
        q: 'What happens if my internet disconnects during an exam?',
        a: 'Your answers are saved automatically every few seconds. If you disconnect, rejoin immediately — your progress will be restored. Contact your teacher if you experience persistent issues.',
      },
      {
        q: 'How can I see my exam results?',
        a: 'After results are published by your teacher, go to Academic → Gradebook or Academic → Exam Results to view your scores and performance details.',
      },
    ],
  },
  {
    category: 'Assignments',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-indigo-600 dark:text-indigo-400',
    questions: [
      {
        q: 'How do I submit an assignment?',
        a: 'Go to Academic → Assignments, click on the assignment you want to submit, then select the "Submit" tab. You can type a written answer, upload a file (PDF, DOC, image), or both. Click "Submit Assignment" to complete your submission.',
      },
      {
        q: 'Can I edit a submission after submitting?',
        a: 'Yes — as long as the deadline has not passed and your submission has not been graded, you can edit it. Open the assignment, go to the "My Submission" tab, and update your answer.',
      },
      {
        q: 'What file types can I upload for submissions?',
        a: 'You can upload PDF, DOC, DOCX, TXT, PNG, JPG, JPEG, and WebP files. The maximum file size is 10 MB.',
      },
    ],
  },
  {
    category: 'Payments',
    icon: <CreditCard className="h-4 w-4" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    questions: [
      {
        q: 'How do I pay my exam fees?',
        a: 'Go to Exam Fee Payment in the sidebar. Click "Pay Now" and you will be directed to a secure Paystack payment page. You can pay with your card, bank transfer, or USSD.',
      },
      {
        q: 'My payment went through but my exam is still locked. What do I do?',
        a: 'On the Exam Fee Payment page, scroll down and use the "Restore with Reference" option. Enter your Paystack payment reference number to unlock your exams. If the issue persists, contact school administration.',
      },
      {
        q: 'Can I get a refund for my exam payment?',
        a: 'Refund policies are set by the school administration. Please contact the school office directly for refund requests.',
      },
    ],
  },
  {
    category: 'Login & Account',
    icon: <LogIn className="h-4 w-4" />,
    color: 'text-orange-600 dark:text-orange-400',
    questions: [
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'On the login page, click "Forgot Password". Enter your registered email address and a reset link will be sent to you. Check your spam folder if you don\'t see it within a few minutes.',
      },
      {
        q: 'My account is locked. What do I do?',
        a: 'Accounts are temporarily locked after multiple failed login attempts. Wait 15–30 minutes and try again. If you are still unable to log in, contact your school administrator.',
      },
      {
        q: 'How do I update my profile information?',
        a: 'Go to Profile in the sidebar. You can update your personal details, contact information, and profile photo there.',
      },
    ],
  },
];

// ── Help Guides ────────────────────────────────────────────────────────────
const GUIDES = [
  { icon: <Video className="h-5 w-5" />,      title: 'How to join a live class',              desc: 'Navigate to Class Schedule and click "Join Class" on any ongoing class.',                           color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { icon: <Lock className="h-5 w-5" />,       title: 'How to unlock an exam after payment',   desc: 'Use the Restore with Reference option on the Exam Fee Payment page.',                               color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  { icon: <BookOpen className="h-5 w-5" />,   title: 'How to download study materials',       desc: 'Visit Library in the sidebar, find your resource and click the Download button.',                   color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800' },
  { icon: <User className="h-5 w-5" />,       title: 'How to complete your profile',          desc: 'Go to Profile and fill in all required fields to unlock all portal features.',                      color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
  { icon: <RotateCcw className="h-5 w-5" />,  title: 'How to view past exam results',         desc: 'Navigate to Gradebook or Exam Results under the Academic section of the sidebar.',                  color: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800' },
  { icon: <Zap className="h-5 w-5" />,        title: 'How to check announcements',            desc: 'Open Communication → Announcements to see the latest notices from administration.',                  color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
];

// ── Main page ──────────────────────────────────────────────────────────────
export default function StudentHelp() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [form, setForm] = useState({ name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(), email: user?.email ?? '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const { data: settings } = useQuery<any>({
    queryKey: ['/api/public/settings'],
    staleTime: 10 * 60 * 1000,
  });

  const parseStringOrArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(v => typeof v === 'string' && v.trim());
    if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(v => typeof v === 'string' && v.trim()) : []; } catch { return []; } }
    return [];
  };
  const schoolEmails = parseStringOrArray(settings?.schoolEmails);
  const schoolPhones = parseStringOrArray(settings?.schoolPhones);
  const primaryEmail = schoolEmails[0] || null;
  const primaryPhone = schoolPhones[0] || null;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, subject: form.subject, message: form.message }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to send');
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: 'Message sent!', description: 'We\'ll get back to you as soon as possible.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    },
  });

  const canSubmit = form.name.trim() && form.email.trim() && form.message.trim() && !submitMutation.isPending;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-5 sm:p-6 shadow-xl shadow-blue-500/20">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Help & Support</h1>
            <p className="text-blue-200 text-sm mt-0.5">Find answers, guides, and contact support</p>
          </div>
        </div>
      </div>

      {/* Quick Help Guides */}
      <section className="space-y-4">
        <SectionHeading icon={<BookOpen className="h-5 w-5 text-violet-600" />} title="Quick Help Guides" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GUIDES.map((g, i) => (
            <div
              key={i}
              data-testid={`card-guide-${i}`}
              className={`flex items-start gap-3 p-4 rounded-xl border ${g.color} transition-all`}
            >
              <span className="flex-shrink-0 mt-0.5">{g.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">{g.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{g.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4" data-testid="section-faq">
        <SectionHeading icon={<HelpCircle className="h-5 w-5 text-violet-600" />} title="Frequently Asked Questions" />

        <div className="space-y-4">
          {FAQ_ITEMS.map((cat) => (
            <div key={cat.category} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Category header */}
              <div className={`flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700`}>
                <span className={cat.color}>{cat.icon}</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{cat.category}</h3>
              </div>

              {/* Questions */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {cat.questions.map((faq, qi) => {
                  const key = `${cat.category}-${qi}`;
                  const isOpen = openFaq === key;
                  return (
                    <div key={qi} data-testid={`faq-${key}`}>
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : key)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 pr-4">{faq.q}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3" data-testid={`faq-answer-${key}`}>
                            {faq.a}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Options + Form — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Contact Options */}
        <div className="lg:col-span-2 space-y-4">
          <SectionHeading icon={<Mail className="h-5 w-5 text-violet-600" />} title="Contact Us" />

          <div className="space-y-3">
            {primaryEmail && (
              <ContactOption
                icon={<Mail className="h-5 w-5" />}
                label="Email"
                value={primaryEmail}
                href={`mailto:${primaryEmail}`}
                color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                testId="link-email"
              />
            )}
            {primaryPhone && (
              <ContactOption
                icon={<Phone className="h-5 w-5" />}
                label="Phone"
                value={primaryPhone}
                href={`tel:${primaryPhone}`}
                color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                testId="link-phone"
              />
            )}
            {primaryPhone && (
              <ContactOption
                icon={<MessageCircle className="h-5 w-5" />}
                label="WhatsApp"
                value="Chat on WhatsApp"
                href={`https://wa.me/${primaryPhone?.replace(/\D/g, '')}`}
                color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                testId="link-whatsapp"
                external
              />
            )}

            {!primaryEmail && !primaryPhone && (
              <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Contact details not configured yet.
              </div>
            )}

            {/* School info */}
            {settings?.schoolAddress && (
              <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{settings?.schoolName || 'School'}</p>
                <p className="text-xs">{settings.schoolAddress}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-3 space-y-4">
          <SectionHeading icon={<Send className="h-5 w-5 text-violet-600" />} title="Send a Message" />

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700" data-testid="success-state-form">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Message Sent!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-4">We received your message and will get back to you as soon as possible.</p>
              <Button variant="outline" className="rounded-xl" onClick={() => { setSubmitted(false); setForm(f => ({ ...f, subject: '', message: '' })); }}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Your Name</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className="rounded-xl"
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Email</label>
                  <Input
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    type="email"
                    className="rounded-xl"
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Subject</label>
                <Input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Payment issue, Login problem…"
                  className="rounded-xl"
                  data-testid="input-subject"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Message</label>
                <Textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your issue in detail…"
                  rows={5}
                  className="rounded-xl resize-y"
                  data-testid="input-message"
                />
              </div>

              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 font-semibold"
                data-testid="button-submit-support"
              >
                {submitMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 animate-spin" /> Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" /> Send Message
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable pieces ────────────────────────────────────────────────────────
function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
    </div>
  );
}

function ContactOption({ icon, label, value, href, color, testId, external }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  color: string;
  testId?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      data-testid={testId}
      className={`flex items-center gap-3 p-4 rounded-xl border ${color} transition-all hover:shadow-sm`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{value}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
    </a>
  );
}

