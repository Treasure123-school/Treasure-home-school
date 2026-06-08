import { SkeletonShimmer, StatsCardSkeleton } from "./skeletons";

/**
 * Page-specific skeleton components for contextual loading states.
 * Each page should use its own skeleton that matches the actual content structure.
 * These are used INSIDE page components during data loading, not as Suspense fallbacks.
 */

// Student Dashboard Skeleton - matches the actual StudentDashboard layout pixel-for-pixel
export function StudentDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-student-dashboard">
      {/* Welcome Banner — mirrors: mb-8 bg-gradient-to-r from-primary to-primary/90 rounded-lg p-6 */}
      <div className="mb-8 bg-gradient-to-r from-primary to-primary/90 rounded-lg p-6">
        <div className="flex items-center gap-4">
          {/* Icon box — mirrors: bg-white/20 backdrop-blur-sm rounded-2xl p-4 */}
          <div className="bg-white/20 rounded-2xl p-4 flex-shrink-0">
            <SkeletonShimmer className="h-10 w-10 bg-white/30" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <SkeletonShimmer className="h-8 w-48 sm:w-64 bg-white/30" />
            <SkeletonShimmer className="h-4 w-56 sm:w-72 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Cards Grid — mirrors: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Each card mirrors: border-none shadow-xl CardContent p-6 */}
        {/* Left: label + large value + caption | Right: colored icon box */}
        {[
          "rounded-xl bg-primary/10",
          "rounded-xl bg-green-500/10",
          "rounded-xl bg-yellow-500/10",
          "rounded-xl bg-primary/10",
        ].map((iconBg, i) => (
          <div key={i} className="rounded-lg bg-card shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  {/* Label */}
                  <SkeletonShimmer className="h-4 w-24" />
                  {/* Large value */}
                  <SkeletonShimmer className="h-10 w-16" />
                </div>
                {/* Icon box — mirrors: p-3 rounded-xl gradient */}
                <SkeletonShimmer className={`h-12 w-12 flex-shrink-0 ${iconBg}`} />
              </div>
              {/* Caption / sub-line */}
              <SkeletonShimmer className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid — mirrors: grid grid-cols-1 lg:grid-cols-2 gap-6 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grades Card — mirrors: Card shadow-lg border-none */}
        <div className="rounded-lg bg-card shadow-lg">
          <div className="p-6 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-9 w-9 rounded-lg" />
              <SkeletonShimmer className="h-5 w-28" />
            </div>
            <SkeletonShimmer className="h-8 w-16" />
          </div>
          <div className="px-6 pb-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>

        {/* Upcoming Exams Card — mirrors: Card shadow-lg border-none */}
        <div className="rounded-lg bg-card shadow-lg">
          <div className="p-6 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-9 w-9 rounded-lg" />
              <SkeletonShimmer className="h-5 w-36" />
            </div>
            <SkeletonShimmer className="h-8 w-16" />
          </div>
          <div className="px-6 pb-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Announcements Card — mirrors: Card lg:col-span-2 shadow-lg border-none (full width row) */}
      <div className="mt-6 rounded-lg bg-card shadow-lg">
        <div className="p-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonShimmer className="h-9 w-9 rounded-lg" />
            <SkeletonShimmer className="h-5 w-40" />
          </div>
          <SkeletonShimmer className="h-8 w-16" />
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <SkeletonShimmer key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Admin Dashboard Skeleton - mirrors the actual AdminDashboard layout pixel-for-pixel
export function AdminDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-admin-dashboard">
      {/* Welcome Banner — mirrors: mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl */}
      <div className="mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Icon box — mirrors: bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg */}
            <div className="bg-white/20 rounded-2xl p-4 flex-shrink-0">
              <SkeletonShimmer className="h-10 w-10 bg-white/30" />
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <SkeletonShimmer className="h-8 w-48 sm:w-60 bg-white/30" />
              <SkeletonShimmer className="h-4 w-52 sm:w-72 bg-white/20" />
            </div>
          </div>
          {/* Date pill — hidden on mobile, visible md+ */}
          <div className="hidden md:block bg-white/10 rounded-lg px-4 py-2">
            <SkeletonShimmer className="h-5 w-32 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Cards Grid — mirrors: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8
          Icon colors: blue, emerald/teal, purple/violet, orange/red */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          "rounded-xl bg-primary/10",
          "rounded-xl bg-emerald-500/10",
          "rounded-xl bg-purple-500/10",
          "rounded-xl bg-orange-500/10",
        ].map((iconBg, i) => (
          <div key={i} className="rounded-lg bg-card shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <SkeletonShimmer className="h-4 w-28" />
                  <SkeletonShimmer className="h-10 w-16" />
                </div>
                <SkeletonShimmer className={`h-12 w-12 flex-shrink-0 ${iconBg}`} />
              </div>
              <SkeletonShimmer className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Card — mirrors: single-column card with grid-cols-1 sm:grid-cols-2 button grid */}
      <div className="mb-6 rounded-lg bg-card border border-border">
        <div className="p-4 sm:p-5 md:p-6 border-b">
          <SkeletonShimmer className="h-5 w-44" />
        </div>
        <div className="p-4 sm:p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonShimmer key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Bottom Section — mirrors: grid grid-cols-1 lg:grid-cols-3 gap-6 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Distribution Chart — lg:col-span-2 */}
        <div className="lg:col-span-2 rounded-lg bg-card shadow-sm border border-border">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-5 w-5 rounded" />
              <SkeletonShimmer className="h-5 w-36" />
            </div>
            <SkeletonShimmer className="h-6 w-20 rounded-full" />
          </div>
          <div className="p-4 sm:p-6">
            <SkeletonShimmer className="h-[280px] w-full rounded-lg" />
          </div>
        </div>

        {/* Right sidebar — Live Overview + Quick Stats */}
        <div className="space-y-6">
          {/* Live Overview card */}
          <div className="rounded-lg bg-card shadow-sm border border-border p-6 space-y-4">
            <SkeletonShimmer className="h-5 w-28" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <SkeletonShimmer className="h-8 w-12" />
                  <SkeletonShimmer className="h-3 w-28" />
                </div>
                <SkeletonShimmer className="h-8 w-8 rounded" />
              </div>
              <SkeletonShimmer className="h-px w-full" />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <SkeletonShimmer className="h-8 w-12" />
                  <SkeletonShimmer className="h-3 w-24" />
                </div>
                <SkeletonShimmer className="h-8 w-8 rounded" />
              </div>
            </div>
          </div>

          {/* Quick Stats card */}
          <div className="rounded-lg bg-card shadow-sm border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <SkeletonShimmer className="h-5 w-24" />
              <SkeletonShimmer className="h-4 w-4" />
            </div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <SkeletonShimmer className="h-4 w-20" />
                  <SkeletonShimmer className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Teacher Dashboard Skeleton - mirrors the actual TeacherDashboard layout pixel-for-pixel
export function TeacherDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-teacher-dashboard">
      {/* Welcome Banner — mirrors: mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl */}
      <div className="mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          {/* Icon box — mirrors: bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg */}
          <div className="bg-white/20 rounded-2xl p-4 flex-shrink-0">
            <SkeletonShimmer className="h-10 w-10 bg-white/30" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <SkeletonShimmer className="h-8 w-48 sm:w-60 bg-white/30" />
            <SkeletonShimmer className="h-4 w-52 sm:w-72 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Cards Grid — mirrors: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 */}
      {/* Stat card icon colors: blue, emerald/teal, purple/violet, orange/red */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          "rounded-xl bg-primary/10",
          "rounded-xl bg-emerald-500/10",
          "rounded-xl bg-purple-500/10",
          "rounded-xl bg-orange-500/10",
        ].map((iconBg, i) => (
          <div key={i} className="rounded-lg bg-card shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <SkeletonShimmer className="h-4 w-28" />
                  <SkeletonShimmer className="h-10 w-16" />
                </div>
                <SkeletonShimmer className={`h-12 w-12 flex-shrink-0 ${iconBg}`} />
              </div>
              <SkeletonShimmer className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content — mirrors: grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 (single column) */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {/* Quick Actions Card — mirrors: Card with grid-cols-1 sm:grid-cols-2 button grid */}
        <div className="rounded-lg bg-card border border-border">
          <div className="p-4 sm:p-5 md:p-6 border-b">
            <SkeletonShimmer className="h-5 w-36" />
          </div>
          <div className="p-4 sm:p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonShimmer key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Recent Exam Results Card — mirrors: Card mt-6 shadow-sm border border-border */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-8 w-8 rounded-lg" />
              <SkeletonShimmer className="h-5 w-40" />
            </div>
            <SkeletonShimmer className="h-8 w-16" />
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Parent Dashboard Skeleton - mirrors the actual ParentDashboard layout pixel-for-pixel
export function ParentDashboardSkeleton() {
  // Colored gradient backgrounds mirroring the parent's fully-colored stat cards
  const statCardGradients = [
    "from-primary to-primary/90",
    "from-emerald-600 to-teal-700",
    "from-purple-600 to-violet-700",
    "from-amber-500 to-orange-600",
  ];
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-parent-dashboard">
      {/* Welcome Banner — mirrors: mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl */}
      <div className="mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          {/* Icon box — mirrors: bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg */}
          <div className="bg-white/20 rounded-2xl p-4 flex-shrink-0">
            <SkeletonShimmer className="h-10 w-10 bg-white/30" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <SkeletonShimmer className="h-8 w-44 sm:w-60 bg-white/30" />
            <SkeletonShimmer className="h-4 w-52 sm:w-72 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Cards Grid — mirrors: grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6
          NOTE: Parent uses grid-cols-2 on mobile (not 1) — cards are fully colored with white text */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {statCardGradients.map((gradient, i) => (
          <div key={i} className={`rounded-lg bg-gradient-to-br ${gradient} shadow-xl overflow-hidden`}>
            <div className="relative p-6 text-white">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-2 flex-1">
                  <SkeletonShimmer className="h-3 w-20 bg-white/30" />
                  <SkeletonShimmer className="h-9 w-14 bg-white/40" />
                  <SkeletonShimmer className="h-3 w-24 bg-white/25" />
                </div>
                {/* Icon box — mirrors: p-3 bg-white/20 backdrop-blur-sm rounded-2xl */}
                <div className="bg-white/20 rounded-2xl p-3 flex-shrink-0">
                  <SkeletonShimmer className="h-6 w-6 bg-white/40" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions — mirrors: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonShimmer key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>

      {/* Children Overview Card — mirrors: Card shadow-sm border border-border mb-4 sm:mb-6 */}
      <div className="rounded-lg bg-card shadow-sm border border-border mb-4 sm:mb-6">
        <div className="p-4 sm:p-6 border-b flex items-center justify-between">
          <SkeletonShimmer className="h-5 w-40" />
          <SkeletonShimmer className="h-8 w-16" />
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {[1, 2].map((i) => (
            <SkeletonShimmer key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Two Column Layout — mirrors: grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        {/* Recent Grades Card */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <SkeletonShimmer className="h-5 w-32" />
            <SkeletonShimmer className="h-8 w-16" />
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Announcements Card */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          <div className="p-4 sm:p-6 border-b flex items-center justify-between">
            <SkeletonShimmer className="h-5 w-36" />
            <SkeletonShimmer className="h-8 w-16" />
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Super Admin Dashboard Skeleton - mirrors the actual SuperAdminDashboard layout pixel-for-pixel
export function SuperAdminDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-superadmin-dashboard">
      {/* Welcome Banner — mirrors: mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl */}
      <div className="mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Icon box — mirrors: bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg */}
            <div className="bg-white/20 rounded-2xl p-4 flex-shrink-0">
              <SkeletonShimmer className="h-10 w-10 bg-white/30" />
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <SkeletonShimmer className="h-8 w-52 sm:w-64 bg-white/30" />
              <SkeletonShimmer className="h-4 w-60 sm:w-80 bg-white/20" />
            </div>
          </div>
          {/* Date pill — hidden on mobile, visible md+ */}
          <div className="hidden md:block bg-white/10 rounded-lg px-4 py-2">
            <SkeletonShimmer className="h-5 w-32 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Cards Grid — mirrors: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6
          Stat card icon colors per actual: blue, green, purple, orange */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          "rounded-xl bg-primary/10",
          "rounded-xl bg-green-500/10",
          "rounded-xl bg-purple-500/10",
          "rounded-xl bg-orange-500/10",
        ].map((iconBg, i) => (
          <div key={i} className="rounded-lg bg-card shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <SkeletonShimmer className="h-4 w-24" />
                  <SkeletonShimmer className="h-10 w-20" />
                </div>
                <SkeletonShimmer className={`h-12 w-12 flex-shrink-0 ${iconBg}`} />
              </div>
              <SkeletonShimmer className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Grid — mirrors: grid grid-cols-1 md:grid-cols-2 gap-6 (action cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg bg-card shadow-lg overflow-hidden">
            <div className="p-6 flex items-center gap-4">
              <SkeletonShimmer className="h-12 w-12 rounded-xl flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <SkeletonShimmer className="h-5 w-32" />
                <SkeletonShimmer className="h-4 w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Status Cards — mirrors: grid grid-cols-1 md:grid-cols-2 gap-6 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Health Card — mirrors: Card shadow-lg border-none */}
        <div className="rounded-lg bg-card shadow-lg overflow-hidden">
          <div className="p-6 pb-2 flex items-center gap-2">
            <SkeletonShimmer className="h-8 w-8 rounded-lg" />
            <SkeletonShimmer className="h-5 w-32" />
          </div>
          <div className="p-6 pt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <SkeletonShimmer className="h-4 w-28" />
                <SkeletonShimmer className="h-4 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Security Overview Card — mirrors: Card shadow-lg border-none */}
        <div className="rounded-lg bg-card shadow-lg overflow-hidden">
          <div className="p-6 pb-2 flex items-center gap-2">
            <SkeletonShimmer className="h-8 w-8 rounded-lg" />
            <SkeletonShimmer className="h-5 w-40" />
          </div>
          <div className="p-6 pt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <SkeletonShimmer className="h-4 w-32" />
                <SkeletonShimmer className="h-5 w-24 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Table Page Skeleton - for pages with data tables
export function TablePageSkeleton({ title }: { title?: string }) {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-table-page">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <SkeletonShimmer className="h-8 w-48" />
          <SkeletonShimmer className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <SkeletonShimmer className="h-10 w-24" />
          <SkeletonShimmer className="h-10 w-32" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SkeletonShimmer className="h-10 w-64" />
        <SkeletonShimmer className="h-10 w-32" />
        <SkeletonShimmer className="h-10 w-32" />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonShimmer key={i} className="h-4 flex-1" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
            {[1, 2, 3, 4, 5].map((j) => (
              <SkeletonShimmer key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <SkeletonShimmer className="h-4 w-32" />
        <div className="flex gap-2">
          <SkeletonShimmer className="h-8 w-8" />
          <SkeletonShimmer className="h-8 w-8" />
          <SkeletonShimmer className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

// Form Page Skeleton - for pages with forms
export function FormPageSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-form-page">
      {/* Page Header */}
      <div className="space-y-1">
        <SkeletonShimmer className="h-8 w-48" />
        <SkeletonShimmer className="h-4 w-96" />
      </div>

      {/* Form Card */}
      <div className="rounded-lg border bg-card max-w-2xl">
        <div className="p-6 space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <SkeletonShimmer className="h-4 w-24" />
              <SkeletonShimmer className="h-10 w-full" />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <SkeletonShimmer className="h-10 w-24" />
            <SkeletonShimmer className="h-10 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Page Skeleton
export function ProfilePageSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-profile-page">
      {/* Profile Header */}
      <div className="flex items-center gap-6">
        <SkeletonShimmer className="h-24 w-24 rounded-full" />
        <div className="space-y-2">
          <SkeletonShimmer className="h-8 w-48" />
          <SkeletonShimmer className="h-4 w-32" />
          <SkeletonShimmer className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* Profile Form */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b">
          <SkeletonShimmer className="h-6 w-40" />
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <SkeletonShimmer className="h-4 w-24" />
              <SkeletonShimmer className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <SkeletonShimmer className="h-10 w-20" />
          <SkeletonShimmer className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

// Minimal Loading Fallback - for code-splitting lazy load
export function MinimalLoadingFallback() {
  return (
    <div 
      className="flex items-center justify-center min-h-[200px]" 
      data-testid="minimal-loading"
      aria-label="Loading page..."
    >
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  );
}
