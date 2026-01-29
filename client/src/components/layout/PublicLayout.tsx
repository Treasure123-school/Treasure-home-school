import { Link, useLocation } from 'wouter';
import { GraduationCap, Menu, X, Phone, Mail, MapPin, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PublicLayoutProps {
  children: React.ReactNode;
}

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolEmail: string;
  schoolPhone: string;
  schoolAddress: string;
  schoolLogo?: string;
  footerText?: string;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    staleTime: 5 * 60 * 1000,
  });

  const schoolName = settings?.schoolName || "Glory Schools";
  const schoolMotto = settings?.schoolMotto || "Nurturing Bright Minds";
  const schoolEmail = settings?.schoolEmail || "gloryschools@aporaj.com";
  const schoolPhone = settings?.schoolPhone || "08037906249, 08107921359";
  const schoolAddress = settings?.schoolAddress || "ALL ONI-ORI, AREA, behind royal palace, Egbedi, Osun State.";

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About School', href: '/about' },
    { name: 'Gallery', href: '/gallery' },
  ];

  const isActive = (path: string) => location === path;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location]);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="container max-w-7xl mx-auto px-4 h-24 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-4">
            <img 
              src="/images/logo.png" 
              alt="Glory Schools Logo" 
              className="h-16 w-16 object-contain"
            />
          </Link>
          
          <nav className="hidden lg:flex items-center gap-12">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-xs font-bold uppercase tracking-widest transition-colors ${
                  isActive(item.href) ? 'text-blue-600' : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Button asChild className="btn-gradient-blue rounded-md px-10 h-14 uppercase text-sm font-bold tracking-widest shadow-lg">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </nav>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-gray-900"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 p-6 space-y-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block text-sm font-bold uppercase tracking-widest text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Button asChild className="w-full bg-[#d946ef] text-white rounded-md h-12 uppercase text-xs font-bold">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        )}
      </header>

      <main className="pt-24">{children}</main>

      {/* Footer */}
      <footer className="bg-[#2c333d] text-white py-24">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
            <div className="lg:col-span-2">
              <img 
                src="/images/logo.png" 
                alt="Glory Schools Logo" 
                className="h-20 w-20 object-contain mb-8 bg-white p-2 rounded-lg"
              />
              <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                Glory Schools, located in Egbedi-Ifo Local Government, Osun State, Nigeria, has a rich history of educational excellence. Founded by Pastor Akinyemi Bolade Emmanuel, the school has been a beacon of learning in the community for several decades.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-8">Useful Links</h3>
              <div className="space-y-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="h-6 w-6 text-blue-600 flex-shrink-0" />
                <p className="text-base text-gray-400">{schoolAddress}</p>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="h-6 w-6 text-blue-600" />
                <p className="text-base text-gray-400">{schoolPhone}</p>
              </div>
              <div className="flex items-center gap-4">
                <Mail className="h-6 w-6 text-blue-600" />
                <p className="text-base text-gray-400">{schoolEmail}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} {schoolName}. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
