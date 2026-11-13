/**
 * Homepage Module
 *
 * Owns the public-website content domain: homepage content images,
 * homepage sections (draft/publish workflow), and announcements.
 *
 * Router: homepageRouter → mounted unprefixed (routes carry full /api paths)
 *   /api/homepage-content*, /api/homepage-sections*, /api/announcements,
 *   /api/admin/announcements, /api/public/homepage-*
 */

export { default as homepageRouter } from './homepage.routes';
