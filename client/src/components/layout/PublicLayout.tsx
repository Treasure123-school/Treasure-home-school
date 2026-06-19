import { Link, useLocation } from 'wouter';
import { Menu, X, Phone, Mail, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ContactUtils } from '@shared/contact-utils';

interface PublicLayoutProps {
  children: React.ReactNode;
}

interface SettingsData {
  schoolName: string;
  schoolMotto?: string;
  schoolEmails: any;
  schoolPhones: any;
  schoolAddress: string;
  schoolLogo?: string;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY <= 100) {
          setShowHeader(true);
        } else if (currentScrollY > lastScrollY) {
          setShowHeader(false);
        } else {
          setShowHeader(true);
        }
        
        setLastScrollY(currentScrollY);
      }
    };

    window.addEventListener('scroll', controlNavbar);
    return () => {
      window.removeEventListener('scroll', controlNavbar);
    };
  }, [lastScrollY]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const schoolName = settings?.schoolName || "";
  const schoolAddress = settings?.schoolAddress || "";
  
  const schoolPhone = ContactUtils.getFormattedPrimaryPhone(settings);
  const schoolEmail = ContactUtils.getPrimaryEmail(settings);

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Portal', href: '/login' },
  ];

  const isActive = (href: string) => location === href;

  return (
    <div className="min-h-screen bg-white">
      {/* Main Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-[100] bg-white shadow-sm h-28 flex items-center transition-transform duration-300 ${
          showHeader || isMobileMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="container max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-4" onClick={() => setIsMobileMenuOpen(false)}>
              {/* Logo — fixed-size container prevents layout shift */}
              <div className="h-20 w-20 shrink-0 flex items-center justify-center">
                {settings?.schoolLogo ? (
                  <img
                    src={settings.schoolLogo}
                    alt="Logo"
                    className="h-20 w-auto object-contain"
                    // @ts-ignore — fetchpriority is a valid HTML attribute; React<18.3 passes it through as-is
                    fetchpriority="high"
                    decoding="async"
                  />
                ) : settings === undefined ? (
                  <Skeleton className="h-16 w-16 rounded-full" />
                ) : null}
              </div>
              {/* School name + motto */}
              <div className="flex flex-col gap-1">
                {settings === undefined ? (
                  <>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </>
                ) : (
                  <>
                    <span className="font-display text-gray-900 font-bold text-xl md:text-2xl tracking-tight leading-tight">
                      {schoolName}
                    </span>
                    {settings?.schoolMotto && (
                      <span className="text-primary text-[10px] md:text-xs font-semibold tracking-wider uppercase">
                        {settings.schoolMotto}
                      </span>
                    )}
                  </>
                )}
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            {navigation.map((item) => (
              <Link key={item.name} href={item.href} className={`font-display text-[11px] font-bold uppercase tracking-widest transition-colors ${isActive(item.href) ? 'text-primary' : 'text-gray-900 hover:text-primary'}`}>{item.name}</Link>
            ))}
            <Button asChild className="btn-primary"><Link href="/contact" className="flex items-center gap-2"><span>Contact Us</span><ArrowRight className="w-3 h-3" /></Link></Button>
          </nav>

          {/* Mobile Menu Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      <div 
        className={`fixed inset-0 bg-white z-[90] lg:hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full pt-44 px-10">
          <nav className="flex flex-col gap-8">
            {navigation.map((item, index) => (
              <Link 
                key={item.name} 
                href={item.href} 
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  transitionDelay: isMobileMenuOpen ? `${index * 70 + 80}ms` : '0ms',
                }}
                className={`font-display text-2xl font-black uppercase tracking-[0.2em] transition-all duration-500 ease-out ${
                  isMobileMenuOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-10'
                } ${isActive(item.href) ? 'text-primary' : 'text-gray-900'}`}
              >
                {item.name}
              </Link>
            ))}
            <div
              style={{
                transitionDelay: isMobileMenuOpen ? `${navigation.length * 70 + 80}ms` : '0ms',
              }}
              className={`transition-all duration-500 ease-out ${
                isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <Button asChild className="btn-primary w-full mt-2 h-14 text-sm font-black uppercase tracking-widest">
                <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-3">
                  <span>Contact Us</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      </div>

      <main className="pt-28">{children}</main>

      <footer className="footer-dark mt-auto">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="space-y-6">
              {settings?.schoolLogo ? (
                <img 
                  src={settings.schoolLogo} 
                  alt="Logo" 
                  className="h-20 w-auto object-contain" 
                />
              ) : null}
              <p className="font-sans text-[13px] text-muted-foreground font-normal leading-relaxed">{settings?.schoolName || "Treasure-Home School"} — nurturing young minds with quality education, strong values, and a lifelong love for learning, one student at a time.</p>
            </div>
            <div className="space-y-6">
              <h4 className="font-display text-foreground font-bold uppercase tracking-widest text-[11px]">Useful Links</h4>
              <ul className="space-y-3">
                {navigation.map((item) => (
                  <li key={item.name}><Link href={item.href} className="font-sans text-[13px] text-muted-foreground font-normal hover:text-primary transition-colors">{item.name}</Link></li>
                ))}
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="font-display text-foreground font-bold uppercase tracking-widest text-[11px]">Contact Info</h4>
              <ul className="space-y-4">
                <li className="flex gap-4"><MapPin className="h-5 w-5 text-primary shrink-0" /><span className="font-sans text-[13px] text-muted-foreground font-normal">{schoolAddress}</span></li>
                {schoolPhone && (
                  <li className="flex gap-4">
                    <Phone className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-sans text-[13px] text-muted-foreground font-normal">{schoolPhone}</span>
                  </li>
                )}
                <li className="flex gap-4"><Mail className="h-5 w-5 text-primary shrink-0" /><span className="font-sans text-[13px] text-muted-foreground font-normal">{schoolEmail}</span></li>
              </ul>
            </div>
          </div>
          <div className="font-display pt-8 border-t border-border text-center text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">© {new Date().getFullYear()} {schoolName}. All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  );
}
