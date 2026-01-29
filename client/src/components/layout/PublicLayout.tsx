import { Link, useLocation } from 'wouter';
import { GraduationCap, Menu, X, Phone, Mail, MapPin, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import schoolLogo from '@assets/school-logo.png';

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
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [underlineStyle, setUnderlineStyle] = useState({ width: 0, left: 0 });
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const navContainerRef = useRef<HTMLDivElement>(null);

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"], // Changed to public settings for better accessibility
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolMotto = settings?.schoolMotto || "Qualitative Education & Moral Excellence";
  const schoolEmail = settings?.schoolEmail || "treasurehomeschool@gmail.com";
  const schoolPhone = settings?.schoolPhone || "08037906249, 08107921359";
  const schoolAddress = settings?.schoolAddress || "Seriki-Soyinka Ifo, Ogun State, Nigeria";
  const displayLogo = settings?.schoolLogo || schoolLogo;
  const footerText = settings?.footerText || `© ${new Date().getFullYear()} ${schoolName}. All rights reserved. | Built with excellence in education.`;

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Admissions', href: '/admissions' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (path: string) => location === path;

  // Update underline position when hovering or location changes
  useEffect(() => {
    const targetHref = hoveredLink || location;
    const targetIndex = navigation.findIndex(item => item.href === targetHref);
    
    if (targetIndex !== -1 && navRefs.current[targetIndex]) {
      const link = navRefs.current[targetIndex];
      setUnderlineStyle({
        width: link.offsetWidth,
        left: link.offsetLeft,
      });
    }
  }, [hoveredLink, location]);

  // Auto-scroll to top when route changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      {/* Clean professional navigation header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm py-2 sm:py-3">
        <nav>
          <div className="container-custom">
            <div className="flex justify-between items-center h-20 sm:h-24">
              {/* Professional school branding */}
              <Link href="/" className="flex items-center space-x-4">
                <div className="rounded-full">
                  <img 
                    src="/images/logo.png" 
                    alt="Glory Schools Logo" 
                    className="h-20 w-20 sm:h-24 sm:w-24 object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {schoolName}
                  </h1>
                  <p className="text-xs sm:text-sm text-blue-600 font-semibold tracking-wide uppercase">
                    {schoolMotto}
                  </p>
                </div>
              </Link>
              
              {/* Desktop Navigation with smooth sliding underline */}
              <div className="hidden lg:flex items-center space-x-8 relative" ref={navContainerRef}>
                {navigation.map((item, index) => (
                  <Link
                    key={item.name}
                    ref={(el) => {
                      navRefs.current[index] = el;
                    }}
                    href={item.href}
                    className={`relative text-sm font-medium transition-colors duration-300 ${
                      isActive(item.href)
                        ? 'text-[#1F51FF] font-semibold'
                        : 'text-gray-700 dark:text-gray-300'
                    } hover:text-[#1F51FF]`}
                    onMouseEnter={() => setHoveredLink(item.href)}
                    onMouseLeave={() => setHoveredLink(null)}
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    {item.name}
                  </Link>
                ))}

                {/* Smooth sliding underline */}
                {underlineStyle.width > 0 && (
                  <div
                    className="absolute h-1 bg-gradient-to-r from-[#1F51FF] to-[#3B6FFF] rounded-full"
                    style={{
                      left: `${underlineStyle.left}px`,
                      width: `${underlineStyle.width}px`,
                      bottom: '-10px',
                      transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                )}
              </div>
              
              {/* Enhanced Mobile menu button */}
              <div className="lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  data-testid="button-mobile-menu"
                  className="h-12 w-12 text-[#1F51FF] hover:bg-gradient-to-br hover:from-[#1F51FF]/10 hover:to-[#3B6FFF]/10 hover:text-[#1A47E6] rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-110 hover:-translate-y-1 border border-transparent hover:border-[#1F51FF]/20"
                >
                  {isMobileMenuOpen ? (
                    <X className="h-6 w-6 transition-transform duration-300 hover:rotate-90" />
                  ) : (
                    <Menu className="h-6 w-6 transition-transform duration-300 hover:rotate-12" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          
        </nav>
        
        {/* Simple Full-Page Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-20 bg-white dark:bg-gray-900 z-40 overflow-y-auto">
            <div className="container mx-auto px-6 py-8">
              <nav className="flex flex-col space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-4 py-4 text-lg font-medium transition-colors duration-200 rounded-lg text-left ${
                      isActive(item.href) 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid={`nav-mobile-${item.name.toLowerCase()}`}
                  >
                    {item.name}
                  </Link>
                ))}
                
                {/* Additional Links */}
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href="/job-vacancy"
                    className="block px-4 py-4 text-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 text-left"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Job Vacancy
                  </Link>
                </div>
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main Content with fade-in animation */}
      <main className="animate-fade-in">{children}</main>

      {/* Beautiful Gradient Footer */}
      <footer className="section-gradient-accent py-16 mt-20">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
            {/* School Branding */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-4 mb-6">
                <div className="rounded-full">
                  <img 
                    src="/images/logo.png" 
                    alt="Glory Schools Logo" 
                    className="h-16 w-16 object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold gradient-text">{schoolName}</h2>
                  <p className="text-muted-foreground font-medium">"{schoolMotto}"</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                Providing quality education with moral excellence. We nurture students from playgroup 
                to senior secondary school, preparing them for success in academics and life.
              </p>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center">
                <Phone className="h-4 w-4 mr-2 text-blue-600" />
                Contact Info
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                  <span>{schoolAddress}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span>{schoolPhone}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span>{schoolEmail}</span>
                </div>
                <div className="pt-2">
                  <p className="text-xs font-semibold uppercase text-blue-600">Office Hours</p>
                  <p className="text-xs">Mon – Fri: 8:00 AM – 4:00 PM</p>
                </div>
                <div className="flex items-center space-x-4 pt-4">
                  <a href="https://wa.me/2348037906249" target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                  <span className="text-xs text-muted-foreground italic">Chat with us!</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
              <div className="space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block text-sm text-muted-foreground hover:text-blue-600 transition-colors duration-200"
                  >
                    {item.name}
                  </Link>
                ))}
                <Link
                  href="/job-vacancy"
                  className="block text-sm text-muted-foreground hover:text-blue-600 transition-colors duration-200"
                  data-testid="link-job-vacancy"
                >
                  Job Vacancy
                </Link>
                <Link
                  href="/login"
                  className="block text-sm text-muted-foreground hover:text-blue-600 transition-colors duration-200"
                >
                  Portal Login
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              {footerText}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
