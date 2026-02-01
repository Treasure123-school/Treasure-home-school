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
  schoolEmail: string;
  schoolPhone: string;
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
  const schoolPhone = settings?.schoolPhone || "080-1734-5676";
  const schoolEmail = settings?.schoolEmail || "info@treasurehomeschool.com";

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About School', href: '/about' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => location === href;

  return (
    <div className="min-h-screen bg-white">
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-28 flex items-center transition-all duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="container max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-4">
              {settings?.schoolLogo ? (
                <img 
                  src={settings.schoolLogo} 
                  alt="Logo" 
                  className="h-20 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] contrast-[1.1] saturate-[1.1]" 
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
              <Link key={item.name} href={item.href} className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive(item.href) ? 'text-[#00BFFF]' : 'text-gray-900 hover:text-[#00BFFF]'}`}>{item.name}</Link>
            ))}
            <Button asChild className="btn-primary"><Link href="/contact" className="flex items-center gap-2"><span>Contact Us</span><ArrowRight className="w-3 h-3" /></Link></Button>
          </nav>

          {/* Mobile Menu Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden relative z-[60]" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation Overlay */}
        <div 
          className={`fixed inset-0 bg-white z-[55] lg:hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
        >
          <div className="flex flex-col h-full pt-32 px-6">
            <nav className="flex flex-col gap-6">
              {navigation.map((item) => (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-lg font-bold uppercase tracking-widest transition-colors ${
                    isActive(item.href) ? 'text-[#00BFFF]' : 'text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <Button asChild className="btn-primary w-full mt-4 h-12">
                <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-2">
                  <span>Contact Us</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="pt-28">{children}</main>

      <footer className="footer-dark mt-auto">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 mb-12">
            <div className="space-y-6">
              {settings?.schoolLogo ? (
                <img src={settings.schoolLogo} alt="Logo" className="h-20 w-auto brightness-0 invert" />
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
                <li className="flex gap-4"><Phone className="h-5 w-5 text-white shrink-0" /><span className="text-[13px] text-white font-bold">{schoolPhone}</span></li>
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
