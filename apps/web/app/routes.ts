import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('health', 'routes/health.ts'),

  // Hosted-login shims — the API's hosted /login page owns the OTP surface.
  route('/auth', 'routes/auth/index.tsx'),
  route('/logout', 'routes/auth/logout.tsx'),

  layout('routes/_authenticated.tsx', [
    layout('routes/layout.tsx', [
      index('routes/home.tsx'),
      route('collections', 'routes/collections/collections.tsx'),
      route('collections/:collectionId', 'routes/collections/collections.$collectionId.tsx'),
      route('tasks', 'routes/tasks/tasks.tsx'),
      route('tasks/:taskId', 'routes/tasks/tasks.$taskId.tsx'),

      // Finance sub-app (docs/web.sub-apps.md)
      route('finance', 'routes/finance/layout.tsx', [
        index('routes/finance/finance.tsx'),
        route('analytics', 'routes/finance/analytics.tsx'),
        route('analytics/tags', 'routes/finance/analytics.tags.tsx'),
        route('analytics/monthly/:month', 'routes/finance/analytics.monthly.$month.tsx'),
        route('analytics/tag/:tag', 'routes/finance/analytics.tag.$tag.tsx'),
        route('accounts', 'routes/finance/accounts.tsx'),
        route('accounts/:id', 'routes/finance/accounts.$id.tsx'),
        route('runway', 'routes/finance/runway.tsx'),
        route('affordability', 'routes/finance/affordability.tsx'),
        route('reconcile', 'routes/finance/reconcile.tsx'),
        route('transfers', 'routes/finance/transfers.tsx'),
      ]),

      // Career sub-app (docs/web.sub-apps.md)
      route('career', 'routes/career/layout.tsx', [
        index('routes/career/home.tsx'),
        route('onboarding', 'routes/career/onboarding.tsx'),
        route('profile', 'routes/career/profile.tsx'),
        route('work', 'routes/career/work.tsx'),
        route('work/new', 'routes/career/work.new.tsx'),
        route('work/:id', 'routes/career/work.$id.tsx'),
        route('projects', 'routes/career/projects.tsx'),
        route('projects/new', 'routes/career/projects.new.tsx'),
        route('projects/:id', 'routes/career/projects.$id.tsx'),
        route('skills', 'routes/career/skills.tsx'),
        route('testimonials', 'routes/career/testimonials.tsx'),
        route('testimonials/new', 'routes/career/testimonials.new.tsx'),
        route('testimonials/:id', 'routes/career/testimonials.$id.tsx'),
        route('applications', 'routes/career/applications.tsx'),
        route('applications/new', 'routes/career/applications.new.tsx'),
        route('applications/:id', 'routes/career/applications.$id.tsx', [
          index('routes/career/applications.$id._index.tsx'),
          route('timeline', 'routes/career/applications.$id.timeline.tsx'),
          route('notes', 'routes/career/applications.$id.notes.tsx'),
          route('files', 'routes/career/applications.$id.files.tsx'),
          route('resume', 'routes/career/applications.$id.resume.tsx'),
        ]),
      ]),
    ]),
    // Redirect-only shims to the API-hosted settings pages — no web layout needed.
    route('settings', 'routes/settings.tsx'),
    route('usage', 'routes/usage.tsx'),
  ]),

  // Public portfolio (docs/web.sub-apps.md, decision D2)
  route('p/:slug', 'routes/p.$slug.tsx'),

  // Catch-all 404 route
  route('*', 'routes/$.tsx'),
] satisfies RouteConfig;
