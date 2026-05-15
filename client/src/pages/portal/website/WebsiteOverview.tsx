import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Images, Newspaper, HelpCircle, BookOpen, Inbox, GraduationCap, Globe, ImageIcon, ArrowRight, CheckCircle, Clock } from 'lucide-react';

interface StatsData {
  galleryCount: number;
  publishedNewsCount: number;
  draftNewsCount: number;
  activeFaqCount: number;
  aboutSectionsCount: number;
  unreadMessagesCount: number;
  newEnquiriesCount: number;
}

const SECTIONS = [
  {
    title: 'Gallery',
    description: 'Upload and organise school photos by event and category',
    icon: Images,
    href: '/portal/admin/website/gallery',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    statKey: 'galleryCount',
    statLabel: 'images',
  },
  {
    title: 'News & Blog',
    description: 'Publish news posts and announcements on the public website',
    icon: Newspaper,
    href: '/portal/admin/website/news',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    statKey: 'publishedNewsCount',
    statLabel: 'published',
  },
  {
    title: 'FAQ',
    description: 'Manage frequently asked questions shown on the website',
    icon: HelpCircle,
    href: '/portal/admin/website/faq',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    statKey: 'activeFaqCount',
    statLabel: 'active FAQs',
  },
  {
    title: 'About Page',
    description: 'Edit content sections on the public About page',
    icon: BookOpen,
    href: '/portal/admin/website/about',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    statKey: 'aboutSectionsCount',
    statLabel: 'sections',
  },
  {
    title: 'Contact Inbox',
    description: 'Read and reply to messages from the website contact form',
    icon: Inbox,
    href: '/portal/admin/website/contact-inbox',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    statKey: 'unreadMessagesCount',
    statLabel: 'unread',
    alert: true,
  },
  {
    title: 'Admissions',
    description: 'Review and process student admissions applications',
    icon: GraduationCap,
    href: '/portal/admin/website/admissions',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    statKey: 'newEnquiriesCount',
    statLabel: 'new enquiries',
    alert: true,
  },
  {
    title: 'Homepage Images',
    description: 'Manage hero, gallery preview, and featured images for the homepage',
    icon: ImageIcon,
    href: '/portal/admin/homepage-management',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
  },
];

const PUBLIC_LINKS = [
  { label: 'Home Page', href: '/' },
  { label: 'About Page', href: '/about' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'News', href: '/news' },
  { label: 'Contact', href: '/contact' },
  { label: 'Admissions', href: '/admissions' },
];

export default function WebsiteOverview() {
  const { data: galleryImages = [] } = useQuery<any[]>({ queryKey: ['/api/admin/gallery'] });
  const { data: newsPosts = [] } = useQuery<any[]>({ queryKey: ['/api/admin/news'] });
  const { data: faqs = [] } = useQuery<any[]>({ queryKey: ['/api/admin/faq'] });
  const { data: aboutSections = [] } = useQuery<any[]>({ queryKey: ['/api/admin/about-sections'] });
  const { data: contactMessages = [] } = useQuery<any[]>({ queryKey: ['/api/admin/contact-messages'] });
  const { data: enquiries = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/admissions-enquiries'],
    queryFn: async () => {
      const res = await fetch('/api/admin/admissions-enquiries', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const stats: StatsData = {
    galleryCount: galleryImages.length,
    publishedNewsCount: newsPosts.filter((p: any) => p.status === 'published').length,
    draftNewsCount: newsPosts.filter((p: any) => p.status === 'draft').length,
    activeFaqCount: faqs.filter((f: any) => f.isActive).length,
    aboutSectionsCount: aboutSections.filter((s: any) => s.isActive).length,
    unreadMessagesCount: contactMessages.filter((m: any) => !m.isRead).length,
    newEnquiriesCount: enquiries.filter((e: any) => e.status === 'new').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" /> Website Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all content on the public-facing school website from one place
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.galleryCount}</p>
            <p className="text-xs text-muted-foreground">Gallery Images</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.publishedNewsCount}</p>
            <p className="text-xs text-muted-foreground">Published News</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-orange-600">{stats.unreadMessagesCount}</p>
              {stats.unreadMessagesCount > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">{stats.unreadMessagesCount}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">Unread Messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-red-600">{stats.newEnquiriesCount}</p>
              {stats.newEnquiriesCount > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">{stats.newEnquiriesCount}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">New Enquiries</p>
          </CardContent>
        </Card>
      </div>

      {/* CMS Sections grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Content Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const statValue = section.statKey ? (stats as any)[section.statKey] : null;
            const hasAlert = section.alert && statValue > 0;
            return (
              <Card key={section.href} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${section.bgColor}`}>
                      <Icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    {statValue !== null && (
                      <Badge variant={hasAlert ? 'destructive' : 'secondary'} className="text-xs">
                        {statValue} {section.statLabel}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{section.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{section.description}</p>
                  <Link href={section.href}>
                    <Button variant="outline" size="sm" className="w-full" data-testid={`button-goto-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      Manage <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Public website preview links */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" /> Public Website Pages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PUBLIC_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs hover:bg-muted transition-colors"
                data-testid={`link-public-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Globe className="h-3 w-3" /> {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
