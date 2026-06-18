import { SkeletonShimmer } from "./skeletons";

/**
 * Re-exported from skeletons.tsx — keeps PortalShells.tsx import working.
 * Used as a Suspense fallback for lazy-loaded portal shell layouts.
 */
export { MinimalRouteFallback as MinimalLoadingFallback } from "./skeletons";

/**
 * Page-specific skeleton components for contextual loading states.
 *
 * Shared primitives at the top prevent repetition across all five
 * portal dashboard skeletons that follow.
 */

// ─── Shared Primitives ────────────────────────────────────────────────────────

/**
 * Mirrors WelcomeCard exactly:
 * rounded-xl gradient banner · icon bubble · name + subtitle · optional date badge
 */
function DashboardWelcomeSkeleton({
  showDate = false,
  className = "mb-6",
}: {
  showDate?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-xl p-6 shadow-xl ${className}`}
    >
      <div className="flex items-center gap-4">
        {/* Icon bubble — mirrors: bg-white/20 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl p-4 */}
        <div className="bg-white/20 rounded-xl sm:rounded-2xl p-4 flex-shrink-0">
          <SkeletonShimmer className="h-7 w-7 bg-white/30" />
        </div>
        {/* Text */}
        <div className="space-y-2 flex-1 min-w-0">
          <SkeletonShimmer className="h-7 w-48 sm:w-64 bg-white/30" />
          <SkeletonShimmer className="h-4 w-52 sm:w-72 bg-white/20" />
        </div>
        {/* Date badge — hidden on mobile, visible sm+ when showDate is set */}
        {showDate && (
          <div className="hidden sm:block bg-white/10 rounded-lg px-4 py-2 flex-shrink-0">
            <SkeletonShimmer className="h-5 w-32 bg-white/20" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mirrors GradientStatCard / StatCardShell + StatCardIcon exactly:
 * white card · decorative glow blob · label / value / sublabel · coloured icon box
 */
function DashboardStatCardSkeleton({ glowColor = "bg-primary/10" }: { glowColor?: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden border-none shadow-xl bg-card">
      {/* Decorative glow blob — mirrors: absolute top-0 right-0 rounded-full w-24 h-24 -mr-12 -mt-12 sm:w-32 sm:h-32 sm:-mr-16 sm:-mt-16 */}
      <div className={`absolute top-0 right-0 rounded-full ${glowColor} w-24 h-24 -mr-12 -mt-12 sm:w-32 sm:h-32 sm:-mr-16 sm:-mt-16`} />
      <div className="p-4 sm:p-6 relative z-10">
        <div className="flex items-start justify-between mb-2 sm:mb-4">
          <div className="space-y-2 flex-1 min-w-0">
            <SkeletonShimmer className="h-4 w-24 sm:w-28" />
            <SkeletonShimmer className="h-8 sm:h-10 w-14 sm:w-16" />
            <SkeletonShimmer className="h-3 w-20 sm:w-24" />
          </div>
          {/* Icon box — mirrors: p-2 sm:p-3 rounded-xl bg-gradient text-white shadow-lg */}
          <SkeletonShimmer className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

/**
 * Four-column stat grid shared by Admin, Teacher, Student, and SuperAdmin dashboards.
 * Each portal passes its own glow colour per card.
 */
function DashboardStatGridSkeleton({
  glowColors,
  className = "grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8",
}: {
  glowColors: string[];
  className?: string;
}) {
  return (
    <div className={`grid ${className}`}>
      {glowColors.map((color, i) => (
        <DashboardStatCardSkeleton key={i} glowColor={color} />
      ))}
    </div>
  );
}

/**
 * Quick-action card row (title header + button grid).
 * Used by Admin and Teacher dashboards.
 */
function QuickActionCardSkeleton({
  columns = "grid-cols-1 sm:grid-cols-2",
  rows = 6,
  className = "",
}: {
  columns?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-lg bg-card border border-border ${className}`}>
      <div className="p-4 sm:p-5 md:p-6 border-b">
        <SkeletonShimmer className="h-5 w-44" />
      </div>
      <div className={`p-4 sm:p-5 md:p-6 grid ${columns} gap-2`}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonShimmer key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Portal-Specific Skeletons ─────────────────────────────────────────────────

// Student Dashboard Skeleton - matches the actual StudentDashboard layout
export function StudentDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-student-dashboard">
      {/* Welcome banner — no date badge on student portal */}
      <DashboardWelcomeSkeleton showDate={false} className="mb-8" />

      {/* Stats grid — grid-cols-2 on mobile matching actual layout */}
      <DashboardStatGridSkeleton
        glowColors={[
          "bg-yellow-500/10",
          "bg-violet-500/10",
          "bg-primary/10",
          "bg-emerald-500/10",
        ]}
      />

      {/* Main content — Recent Grades + Upcoming Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grades card */}
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

        {/* Upcoming Exams card */}
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

      {/* Announcements — full-width row */}
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

// Admin Dashboard Skeleton - matches the actual AdminDashboard layout
export function AdminDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-admin-dashboard">
      {/* Welcome banner — Admin shows date badge */}
      <DashboardWelcomeSkeleton showDate />

      {/* Stats grid */}
      <DashboardStatGridSkeleton
        glowColors={[
          "bg-primary/10",
          "bg-emerald-500/10",
          "bg-purple-500/10",
          "bg-orange-500/10",
        ]}
      />

      {/* Quick Administration card */}
      <QuickActionCardSkeleton columns="grid-cols-1 sm:grid-cols-2" rows={6} className="mb-6" />

      {/* User Distribution Chart + Live Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart card — lg:col-span-2 */}
        <div className="lg:col-span-2 rounded-lg bg-card shadow-sm border border-border overflow-hidden">
          {/* Gradient header strip — mirrors indigo-to-violet header */}
          <div className="h-14 bg-gradient-to-r from-indigo-600/20 to-violet-600/20 px-6 flex items-center justify-between">
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
          <div className="rounded-lg bg-card shadow-sm border border-border p-6 space-y-4">
            <SkeletonShimmer className="h-5 w-28" />
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <SkeletonShimmer className="h-8 w-12" />
                  <SkeletonShimmer className="h-3 w-28" />
                </div>
                <SkeletonShimmer className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>

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

// Teacher Dashboard Skeleton - matches the actual TeacherDashboard layout
export function TeacherDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" data-testid="skeleton-teacher-dashboard">
      {/* Welcome banner — Teacher shows date badge */}
      <DashboardWelcomeSkeleton showDate />

      {/* Stats grid */}
      <DashboardStatGridSkeleton
        glowColors={[
          "bg-primary/10",
          "bg-emerald-500/10",
          "bg-purple-500/10",
          "bg-orange-500/10",
        ]}
      />

      {/* Quick Actions + Recent Exam Results */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <QuickActionCardSkeleton columns="grid-cols-1 sm:grid-cols-2" rows={4} />

        {/* Recent Exam Results card */}
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

// Parent Dashboard Skeleton - matches the actual ParentDashboard layout
export function ParentDashboardSkeleton() {
  // Full-bleed coloured cards used in parent portal only
  const parentCardGradients = [
    "from-primary to-primary/90",
    "from-emerald-600 to-teal-700",
    "from-purple-600 to-violet-700",
    "from-amber-500 to-orange-600",
  ];

  return (
    <div className="animate-in fade-in duration-200 space-y-6 sm:space-y-8" data-testid="skeleton-parent-dashboard">
      {/* Welcome banner — parent does not show date badge */}
      <DashboardWelcomeSkeleton showDate={false} className="" />

      {/* Child Selector card */}
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 p-4 sm:p-6 flex items-center gap-4">
        <SkeletonShimmer className="h-12 w-12 rounded-xl flex-shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <SkeletonShimmer className="h-5 w-48" />
          <SkeletonShimmer className="h-4 w-64" />
        </div>
      </div>

      {/* Stats — fully coloured gradient cards, grid-cols-2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {parentCardGradients.map((gradient, i) => (
          <div key={i} className={`rounded-lg bg-gradient-to-br ${gradient} shadow-xl overflow-hidden`}>
            <div className="p-5 text-white">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-2 flex-1">
                  <SkeletonShimmer className="h-3 w-20 bg-white/30" />
                  <SkeletonShimmer className="h-8 w-14 bg-white/40" />
                  <SkeletonShimmer className="h-3 w-24 bg-white/25" />
                </div>
                {/* Icon bubble */}
                <div className="bg-white/20 rounded-xl p-2.5 flex-shrink-0">
                  <SkeletonShimmer className="h-7 w-7 bg-white/40" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions — 4-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonShimmer key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>

      {/* Children Overview card */}
      <div className="rounded-lg bg-card shadow-sm border border-border">
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

      {/* Recent Grades + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        {["Recent Grades", "Announcements"].map((_, i) => (
          <div key={i} className="rounded-lg bg-card shadow-sm border border-border">
            <div className="p-4 sm:p-6 border-b flex items-center justify-between">
              <SkeletonShimmer className="h-5 w-32" />
              <SkeletonShimmer className="h-8 w-16" />
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              {[1, 2, 3].map((j) => (
                <SkeletonShimmer key={j} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Super Admin Dashboard Skeleton - matches the actual SuperAdminDashboard layout
export function SuperAdminDashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-200 space-y-6" data-testid="skeleton-superadmin-dashboard">
      {/* Welcome banner — SuperAdmin shows date badge */}
      <DashboardWelcomeSkeleton showDate className="mb-6" />

      {/* Stats grid — grid-cols-2 on mobile matching actual layout */}
      <DashboardStatGridSkeleton
        glowColors={[
          "bg-primary/10",
          "bg-green-500/10",
          "bg-purple-500/10",
          "bg-orange-500/10",
        ]}
        className="grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
      />

      {/* Quick Actions — 2×2 grid with icon + title + description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg bg-card shadow-lg overflow-hidden">
            <div className="p-6 flex items-center gap-4">
              <SkeletonShimmer className="h-12 w-12 rounded-xl flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <SkeletonShimmer className="h-5 w-32" />
                <SkeletonShimmer className="h-4 w-48" />
              </div>
              <SkeletonShimmer className="h-5 w-5 rounded flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* System Health + Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { width: "w-32", rows: ["w-28", "w-24", "w-36"] },
          { width: "w-40", rows: ["w-32", "w-28", "w-40"] },
        ].map((card, ci) => (
          <div key={ci} className="rounded-lg bg-card shadow-lg overflow-hidden">
            <div className="p-6 pb-2 flex items-center gap-2">
              <SkeletonShimmer className="h-8 w-8 rounded-lg" />
              <SkeletonShimmer className={`h-5 ${card.width}`} />
            </div>
            <div className="p-6 pt-4 space-y-4">
              {card.rows.map((w, ri) => (
                <div key={ri} className="flex items-center justify-between">
                  <SkeletonShimmer className={`h-4 ${w}`} />
                  <SkeletonShimmer className="h-4 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Table Page Skeleton ───────────────────────────────────────────────────────

export function TablePageSkeleton({ title }: { title?: string }) {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200" data-testid="skeleton-table-page">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <SkeletonShimmer className={`h-8 ${title ? 'w-auto' : 'w-48'}`} style={title ? { width: `${title.length * 12}px` } : undefined} />
          <SkeletonShimmer className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <SkeletonShimmer className="h-9 w-24" />
          <SkeletonShimmer className="h-9 w-32" />
        </div>
      </div>

      {/* Search/Filter bar */}
      <div className="flex gap-3">
        <SkeletonShimmer className="h-10 flex-1 max-w-sm" />
        <SkeletonShimmer className="h-10 w-32" />
        <SkeletonShimmer className="h-10 w-28" />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
          {[32, null, null, null, 20].map((w, i) => (
            <SkeletonShimmer
              key={i}
              className={`h-4 ${w ? `w-${w}` : 'flex-1'}`}
            />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
            {[32, null, null, null, 20].map((w, j) => (
              <SkeletonShimmer
                key={j}
                className={`h-4 ${w ? `w-${w}` : 'flex-1'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
