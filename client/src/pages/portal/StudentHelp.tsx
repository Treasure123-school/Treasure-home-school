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
    color: 'text-primary dark:text-primary/70',
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
  { icon: <Video className="h-4 w-4" />,      title: 'How to join a live class',              desc: 'Navigate to Class Schedule and click "Join Class" on any ongoing class.' },
  { icon: <Lock className="h-4 w-4" />,       title: 'How to unlock an exam after payment',   desc: 'Use the Restore with Reference option on the Exam Fee Payment page.' },
  { icon: <BookOpen className="h-4 w-4" />,   title: 'How to download study materials',       desc: 'Visit Library in the sidebar, find your resource and click the Download button.' },
  { icon: <User className="h-4 w-4" />,       title: 'How to complete your profile',          desc: 'Go to Profile and fill in all required fields to unlock all portal features.' },
  { icon: <RotateCcw className="h-4 w-4" />,  title: 'How to view past exam results',         desc: 'Navigate to Gradebook or Exam Results under the Academic section of the sidebar.' },
  { icon: <Zap className="h-4 w-4" />,        title: 'How to check announcements',            desc: 'Open Communication → Announcements to see the latest notices from administration.' },
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
      toast({ title: 'Success', description: "Message sent — we'll get back to you as soon as possible." });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    },
  });

  const canSubmit = form.name.trim() && form.email.trim() && form.message.trim() && !submitMutation.isPending;

  return (
    <div className="space-y-8 pb-8" data-testid="student-help">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          Help & Support
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Find answers, guides, and contact support</p>
      </div>

      {/* Quick Help Guides */}
      <section className="space-y-3">
        <SectionHeading icon={<BookOpen className="h-4 w-4" />} title="Quick Help Guides" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GUIDES.map((g, i) => (
            <div
              key={i}
              data-testid={`card-guide-${i}`}
              className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-shadow"
            >
              <span className="flex-shrink-0 mt-0.5 text-primary">{g.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{g.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-3" data-testid="section-faq">
        <SectionHeading icon={<HelpCircle className="h-4 w-4" />} title="Frequently Asked Questions" />

        <div className="space-y-3">
          {FAQ_ITEMS.map((cat) => (
            <div key={cat.category} className="rounded-xl border bg-card overflow-hidden">
              {/* Category header */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                <span className="text-primary">{cat.icon}</span>
                <h3 className="text-sm font-semibold">{cat.category}</h3>
              </div>

              {/* Questions */}
              <div className="divide-y divide-border">
                {cat.questions.map((faq, qi) => {
                  const key = `${cat.category}-${qi}`;
                  const isOpen = openFaq === key;
                  return (
                    <div key={qi} data-testid={`faq-${key}`}>
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : key)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-sm font-medium pr-4">{faq.q}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3">
                          <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 rounded-lg p-3" data-testid={`faq-answer-${key}`}>
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
        <div className="lg:col-span-2 space-y-3">
          <SectionHeading icon={<Mail className="h-4 w-4" />} title="Contact Us" />

          <div className="space-y-2">
            {primaryEmail && (
              <ContactOption
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={primaryEmail}
                href={`mailto:${primaryEmail}`}
                testId="link-email"
              />
            )}
            {primaryPhone && (
              <ContactOption
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={primaryPhone}
                href={`tel:${primaryPhone}`}
                testId="link-phone"
              />
            )}
            {primaryPhone && (
              <ContactOption
                icon={<MessageCircle className="h-4 w-4" />}
                label="WhatsApp"
                value="Chat on WhatsApp"
                href={`https://wa.me/${primaryPhone?.replace(/\D/g, '')}`}
                testId="link-whatsapp"
                external
              />
            )}

            {!primaryEmail && !primaryPhone && (
              <div className="text-center py-6 text-sm text-muted-foreground bg-muted/40 rounded-xl">
                <AlertCircle className="h-7 w-7 mx-auto mb-2 opacity-40" />
                Contact details not configured yet.
              </div>
            )}

            {settings?.schoolAddress && (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <p className="font-semibold text-sm mb-0.5">{settings?.schoolName || 'School'}</p>
                <p className="text-xs text-muted-foreground">{settings.schoolAddress}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-3 space-y-3">
          <SectionHeading icon={<Send className="h-4 w-4" />} title="Send a Message" />

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border bg-card" data-testid="success-state-form">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Message Sent!</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">We received your message and will get back to you as soon as possible.</p>
              <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setForm(f => ({ ...f, subject: '', message: '' })); }}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Your Name</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    type="email"
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Payment issue, Login problem…"
                  data-testid="input-subject"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Message</label>
                <Textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your issue in detail…"
                  rows={4}
                  className="resize-y"
                  data-testid="input-message"
                />
              </div>

              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit}
                className="w-full"
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
      <span className="text-primary">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

function ContactOption({ icon, label, value, href, testId, external }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  testId?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      data-testid={testId}
      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-shadow"
    >
      <span className="flex-shrink-0 text-primary">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
    </a>
  );
}

