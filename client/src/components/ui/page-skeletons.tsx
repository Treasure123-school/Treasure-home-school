import { SkeletonShimmer, StatsCardSkeleton } from "./skeletons";

/**
 * Page-specific skeleton components for contextual loading states.
 * Each page should use its own skeleton that matches the actual content structure.
 * These are used INSIDE page components during data loading, not as Suspense fallbacks.
 */

// Student Dashboard Skeleton - matches the actual StudentDashboard layout
export function StudentDashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-student-dashboard">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <SkeletonShimmer className="h-[72px] w-[72px] rounded-2xl bg-white/20 flex-shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <SkeletonShimmer className="h-7 w-56 bg-white/30" />
            <SkeletonShimmer className="h-4 w-72 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grades Card */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-9 w-9 rounded-lg" />
              <SkeletonShimmer className="h-5 w-28" />
            </div>
            <SkeletonShimmer className="h-8 w-20" />
          </div>
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Upcoming Exams Card */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-9 w-9 rounded-lg" />
              <SkeletonShimmer className="h-5 w-32" />
            </div>
            <SkeletonShimmer className="h-8 w-20" />
          </div>
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Announcements Card - Full Width */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonShimmer className="h-9 w-9 rounded-lg" />
            <SkeletonShimmer className="h-5 w-40" />
          </div>
          <SkeletonShimmer className="h-8 w-20" />
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <SkeletonShimmer key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Admin Dashboard Skeleton - matches the actual AdminDashboard layout
export function AdminDashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-admin-dashboard">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <SkeletonShimmer className="h-[72px] w-[72px] rounded-2xl bg-white/20" />
          <div className="space-y-2">
            <SkeletonShimmer className="h-8 w-56 bg-white/30" />
            <SkeletonShimmer className="h-4 w-72 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Main Content - 3 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Administration Card */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 border-b">
              <SkeletonShimmer className="h-6 w-40" />
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonShimmer key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>

          {/* Chart Card */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <SkeletonShimmer className="h-6 w-36" />
              <SkeletonShimmer className="h-6 w-20 rounded-full" />
            </div>
            <div className="p-6">
              <SkeletonShimmer className="h-[300px] w-full rounded-lg" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
            <SkeletonShimmer className="h-5 w-28" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SkeletonShimmer className="h-10 w-20" />
                <SkeletonShimmer className="h-8 w-8" />
              </div>
              <SkeletonShimmer className="h-px w-full" />
              <div className="flex items-center justify-between">
                <SkeletonShimmer className="h-10 w-20" />
                <SkeletonShimmer className="h-8 w-8" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
            <SkeletonShimmer className="h-5 w-24" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <SkeletonShimmer className="h-4 w-24" />
                  <SkeletonShimmer className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Teacher Dashboard Skeleton - matches the actual TeacherDashboard layout
export function TeacherDashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-teacher-dashboard">
      {/* Teacher Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <SkeletonShimmer className="h-[72px] w-[72px] rounded-2xl bg-white/20" />
          <div className="space-y-2">
            <SkeletonShimmer className="h-8 w-56 bg-white/30" />
            <SkeletonShimmer className="h-4 w-64 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grading Queue Card */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-9 w-9 rounded-lg" />
              <SkeletonShimmer className="h-5 w-28" />
            </div>
            <SkeletonShimmer className="h-8 w-20" />
          </div>
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Recent Exam Results Card */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonShimmer className="h-9 w-9 rounded-lg" />
              <SkeletonShimmer className="h-5 w-40" />
            </div>
            <SkeletonShimmer className="h-8 w-20" />
          </div>
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Announcements Card */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonShimmer className="h-9 w-9 rounded-lg" />
            <SkeletonShimmer className="h-5 w-36" />
          </div>
          <SkeletonShimmer className="h-8 w-20" />
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <SkeletonShimmer key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Parent Dashboard Skeleton - matches the actual ParentDashboard layout
export function ParentDashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-parent-dashboard">
      {/* Parent Header */}
      <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <SkeletonShimmer className="h-[72px] w-[72px] rounded-2xl bg-white/20" />
          <div className="space-y-2">
            <SkeletonShimmer className="h-8 w-48 bg-white/30" />
            <SkeletonShimmer className="h-4 w-72 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Child Selector */}
      <div className="flex items-center gap-4">
        <SkeletonShimmer className="h-4 w-24" />
        <SkeletonShimmer className="h-10 w-64 rounded-md" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Child Performance Card */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 border-b">
            <SkeletonShimmer className="h-5 w-36" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <SkeletonShimmer className="h-4 w-32" />
                <SkeletonShimmer className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Announcements Card */}
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <SkeletonShimmer className="h-5 w-32" />
            <SkeletonShimmer className="h-8 w-20" />
          </div>
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Super Admin Dashboard Skeleton
export function SuperAdminDashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-superadmin-dashboard">
      {/* Super Admin Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <SkeletonShimmer className="h-[72px] w-[72px] rounded-2xl bg-white/20" />
          <div className="space-y-2">
            <SkeletonShimmer className="h-8 w-64 bg-white/30" />
            <SkeletonShimmer className="h-4 w-80 bg-white/20" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 border-b">
              <SkeletonShimmer className="h-6 w-40" />
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonShimmer key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
            <SkeletonShimmer className="h-5 w-28" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonShimmer key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
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
