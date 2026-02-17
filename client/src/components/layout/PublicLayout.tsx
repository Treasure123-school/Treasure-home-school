import { Link, useLocation } from 'wouter';
import { Menu, X, Phone, Mail, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

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
  });

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY <= 100) {
          setShowHeader(true);
        } else if (currentScrollY > lastScrollY) {
          // Scrolling down
          setShowHeader(false);
        } else {
          // Scrolling up
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

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolAddress = settings?.schoolAddress || "Seriki-Soyinka, Ifo, Ogun State, Nigeria";
  const schoolPhones: Array<{ countryCode: string; number: string }> = (() => {
    try {
      const phones = settings?.schoolPhones || "[]";
      return JSON.parse(typeof phones === 'string' ? phones : JSON.stringify(phones));
    } catch (e) {
      return [];
    }
  })();

  const displayPhone = schoolPhones.length > 0 
    ? `${schoolPhones[0].countryCode}${schoolPhones[0].number}`
    : "";

  const schoolPhone = displayPhone;
  const schoolEmail = Array.isArray(settings?.schoolEmails) 
    ? settings.schoolEmails[0] 
    : (() => {
        try {
          const emails = JSON.parse(settings?.schoolEmails || "[]");
          return Array.isArray(emails) ? emails[0] : "";
        } catch (e) {
          return "";
        }
      })();

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
              {settings?.schoolLogo ? (
                <img 
                  src={settings.schoolLogo} 
                  alt="Logo" 
                  className="h-20 w-auto object-contain" 
                />
              ) : null}
              <div className="flex flex-col">
                <span className="text-gray-900 font-bold text-xl md:text-2xl tracking-tight leading-tight">
                  {schoolName}
                </span>
                {settings?.schoolMotto && (
                  <span className="text-blue-600 text-[10px] md:text-xs font-semibold tracking-wider uppercase">
                    {settings.schoolMotto}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            {navigation.map((item) => (
              <Link key={item.name} href={item.href} className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive(item.href) ? 'text-blue-600' : 'text-gray-900 hover:text-blue-600'}`}>{item.name}</Link>
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
            {navigation.map((item) => (
              <Link 
                key={item.name} 
                href={item.href} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-2xl font-black uppercase tracking-[0.2em] transition-colors ${
                  isActive(item.href) ? 'text-blue-600' : 'text-gray-900'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Button asChild className="btn-primary w-full mt-6 h-14 text-sm font-black uppercase tracking-widest">
              <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-3">
                <span>Contact Us</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </nav>
        </div>
      </div>

      <main className="pt-28">{children}</main>

      <footer className="footer-dark mt-auto">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 mb-12">
            <div className="space-y-6">
              {settings?.schoolLogo ? (
                <img 
                  src={settings.schoolLogo} 
                  alt="Logo" 
                  className="h-20 w-auto brightness-0 invert object-contain" 
                />
              ) : null}
              <p className="text-[13px] text-white font-bold leading-relaxed">{settings?.schoolName || "Treasure-Home School"}, located at Seriki-Soyinka, Ifo Local Government, Ogun State, Nigeria, has a rich history of educational excellence.</p>
            </div>
            <div className="space-y-6">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] border-b border-white/40 pb-2">Useful Links</h4>
              <ul className="space-y-3">
                {navigation.map((item) => (
                  <li key={item.name}><Link href={item.href} className="text-[13px] text-white font-bold hover:text-white/80 transition-colors">{item.name}</Link></li>
                ))}
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] border-b border-white/40 pb-2">Contact Info</h4>
              <ul className="space-y-4">
                <li className="flex gap-4"><MapPin className="h-5 w-5 text-white shrink-0" /><span className="text-[13px] text-white font-bold">{schoolAddress}</span></li>
                {schoolPhone && (
                  <li className="flex gap-4">
                    <Phone className="h-5 w-5 text-white shrink-0" />
                    <span className="text-[13px] text-white font-bold">{schoolPhone}</span>
                  </li>
                )}
                <li className="flex gap-4"><Mail className="h-5 w-5 text-white shrink-0" /><span className="text-[13px] text-white font-bold">{schoolEmail}</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/40 text-center text-[10px] text-white font-black uppercase tracking-widest">© {new Date().getFullYear()} {schoolName}. All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  );
}
