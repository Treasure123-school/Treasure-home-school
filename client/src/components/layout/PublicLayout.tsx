import { Link, useLocation } from 'wouter';
import { Menu, X, Phone, Mail, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
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
  
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
  });

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-24 flex items-center">
        <div className="container max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-4">
              <img 
                src={settings?.schoolLogo || "/images/logo.png"} 
                alt="Logo" 
                className="h-16 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] contrast-[1.1] saturate-[1.1]" 
              />
              <div className="flex flex-col">
                <span className="text-gray-900 font-bold text-lg md:text-xl leading-tight">
                  {schoolName}
                </span>
                {settings?.schoolMotto && (
                  <span className="text-[#00BFFF] text-xs md:text-sm font-medium italic">
                    {settings.schoolMotto}
                  </span>
                )}
              </div>
            </Link>
          </div>
          <nav className="hidden lg:flex items-center gap-10">
            {navigation.map((item) => (
              <Link key={item.name} href={item.href} className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive(item.href) ? 'text-[#00BFFF]' : 'text-gray-900 hover:text-[#00BFFF]'}`}>{item.name}</Link>
            ))}
            <Button asChild className="btn-primary"><Link href="/contact" className="flex items-center gap-2"><span>Contact Us</span><ArrowRight className="w-3 h-3" /></Link></Button>
          </nav>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X /> : <Menu />}</Button>
        </div>
      </header>

      <main className="pt-24">{children}</main>

      <footer className="footer-dark mt-auto">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 mb-12">
            <div className="space-y-6">
              <img src={settings?.schoolLogo || "/images/logo.png"} alt="Logo" className="h-20 w-auto brightness-0 invert" />
              <p className="text-[13px] text-white font-bold leading-relaxed">{settings?.schoolName || "Glory Schools"}, located in Egbedi-Ifo Local Government, Osun State, Nigeria, has a rich history of educational excellence.</p>
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
