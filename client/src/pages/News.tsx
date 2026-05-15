import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import PublicLayout from '@/components/layout/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Newspaper, Calendar, Tag, Search, ArrowRight, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import heroStudents from "@/assets/hero-students.png";

interface NewsPost {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  category: string;
  tags: string;
  status: string;
  publishedAt?: string;
  createdAt: string;
}

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function NewsDetail({ slug }: { slug: string }) {
  const [, navigate] = useLocation();
  const { data: post, isLoading } = useQuery<NewsPost>({
    queryKey: ['/api/public/news', slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/news/${slug}`);
      if (!res.ok) throw new Error('Not found');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="h-8 bg-gray-100 animate-pulse rounded mb-4 w-3/4" />
          <div className="h-64 bg-gray-100 animate-pulse rounded mb-8" />
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded mb-3" />)}
        </div>
      </PublicLayout>
    );
  }

  if (!post) {
    return (
      <PublicLayout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <Newspaper className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Post not found</h2>
          <p className="text-gray-500 mb-6">This article may have been removed or is no longer published.</p>
          <Button onClick={() => navigate('/news')}>Back to News</Button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      {post.coverImageUrl && (
        <div className="relative h-72 md:h-96 overflow-hidden">
          <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-0 right-0 px-4 max-w-3xl mx-auto text-white">
            <Badge className="mb-2 capitalize bg-primary/80 text-white border-0">{post.category}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground" onClick={() => navigate('/news')}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to News
        </Button>
        {!post.coverImageUrl && (
          <>
            <Badge className="mb-3 capitalize">{post.category}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
          </>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 pb-6 border-b">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {post.publishedAt
              ? format(new Date(post.publishedAt), 'MMMM d, yyyy')
              : format(new Date(post.createdAt), 'MMMM d, yyyy')}
          </span>
          {parseTags(post.tags).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="h-3.5 w-3.5" />
              {parseTags(post.tags).map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </div>
      </div>
    </PublicLayout>
  );
}

export default function News() {
  const [, params] = useLocation();
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (slug) return <NewsDetail slug={slug} />;

  return <NewsList />;
}

function NewsList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: posts = [], isLoading } = useQuery<NewsPost[]>({
    queryKey: ['/api/public/news'],
  });

  const categories = ['all', ...Array.from(new Set(posts.map(p => p.category)))];

  const filtered = posts.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.excerpt || '').toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroStudents} alt="News Banner" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="container relative z-10 text-center text-white px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-4"
          >
            News & Updates
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-gray-200"
          >
            Stay informed with the latest from our school community
          </motion.p>
        </div>
      </section>

      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search + filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search news..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-news-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full capitalize"
                  onClick={() => setSelectedCategory(cat)}
                  data-testid={`filter-news-${cat}`}
                >
                  {cat === 'all' ? 'All' : cat}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden border">
                  <div className="h-48 bg-gray-100 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-100 animate-pulse rounded w-1/3" />
                    <div className="h-6 bg-gray-100 animate-pulse rounded w-full" />
                    <div className="h-4 bg-gray-100 animate-pulse rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Newspaper className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">
                {posts.length === 0 ? 'No news posts yet' : 'No posts match your search'}
              </p>
              {search && (
                <Button variant="outline" className="mt-4" onClick={() => setSearch('')}>Clear Search</Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (index % 3) * 0.1 }}
                >
                  <Card
                    className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group h-full flex flex-col"
                    onClick={() => navigate(`/news?slug=${post.slug}`)}
                    data-testid={`card-news-post-${post.id}`}
                  >
                    {post.coverImageUrl ? (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                        <Newspaper className="h-12 w-12 text-primary/40" />
                      </div>
                    )}
                    <CardContent className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs capitalize">{post.category}</Badge>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {post.publishedAt
                            ? format(new Date(post.publishedAt), 'MMM d, yyyy')
                            : format(new Date(post.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2" data-testid={`text-news-post-title-${post.id}`}>
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-sm text-gray-500 line-clamp-3 flex-1">{post.excerpt}</p>
                      )}
                      <div className="flex items-center gap-1 text-primary text-sm font-medium mt-4">
                        Read more <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
