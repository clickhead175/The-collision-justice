import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/brand';

const routes = ['/', '/about', '/faq', '/contact', '/privacy-policy', '/terms', '/get-a-quote', '/check-claim'];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/get-a-quote' ? 0.9 : 0.7,
  }));
}