import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Info } from "lucide-react";
import type { ContextFilters } from "../types";

interface ContextFilterBarProps {
  value:      ContextFilters;
  onChange:   (v: ContextFilters) => void;
  showBank?:  boolean;
}

export function ContextFilterBar({ value, onChange, showBank = true }: ContextFilterBarProps) {
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });
  const { currentTerm } = useAcademicCalendar();

  const { data: classSubjects = [], isLoading: subjectsLoading } = useQuery<any[]>({
    queryKey:  ["/api/classes", value.classId, "available-subjects"],
    queryFn:   () => apiRequest("GET", `/api/classes/${value.classId}/available-subjects`).then(r => r.json()),
    enabled:   !!value.classId,
    staleTime: 60_000,
  });

  const canLoadBanks = !!value.classId && !!value.subjectId;

  const bankParams = useMemo(() => {
    if (!canLoadBanks) return null;
    const p = new URLSearchParams({
      classId:   String(value.classId!),
      subjectId: String(value.subjectId!),
    });
    if (value.termName && value.termName !== 'all') {
      p.set("termName", value.termName);
    }
    return p.toString();
  }, [canLoadBanks, value.classId, value.subjectId, value.termName]);

  const { data: banks = [], isLoading: banksLoading } = useQuery<any[]>({
    queryKey:  ["/api/question-banks", "filtered", value.classId, value.subjectId, value.termName ?? 'all'],
    queryFn:   (): Promise<any[]> => apiRequest("GET", `/api/question-banks?${bankParams}`).then(r => r.json()),
    enabled:   canLoadBanks && !!bankParams,
    staleTime: 30_000,
  });

  const steps = [
    { n: 1, label: "Class",   done: !!value.classId },
    { n: 2, label: "Subject", done: !!value.subjectId },
    { n: 3, label: "Term",    done: !!value.termName },
    ...(showBank ? [{ n: 4, label: "Bank *", done: !!value.bankId }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Progress steps */}
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors
                ${s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {s.done ? <Check className="w-2.5 h-2.5" /> : s.n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${s.done ? "text-primary" : "text-muted-foreground/60"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-5 h-px flex-shrink-0 ${s.done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Filter grid */}
      <div className={`grid gap-3 ${showBank ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        {/* Class */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Class <span className="text-destructive normal-case tracking-normal">*</span>
          </Label>
          <Select
            value={value.classId ? String(value.classId) : ""}
            onValueChange={(v) => onChange({ ...value, classId: Number(v), subjectId: undefined, bankId: undefined })}
            disabled={(classes as any[]).length === 0}
          >
            <SelectTrigger data-testid="ctx-select-class" className="h-9">
              <SelectValue placeholder={
                (classes as any[]).length === 0 ? "No classes available" : "Select class…"
              } />
            </SelectTrigger>
            <SelectContent>
              {(classes as any[]).length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">No classes available</div>
              ) : (
                (classes as any[]).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Subject <span className="text-destructive normal-case tracking-normal">*</span>
          </Label>
          <Select
            value={value.subjectId ? String(value.subjectId) : ""}
            onValueChange={(v) => onChange({ ...value, subjectId: Number(v), bankId: undefined })}
            disabled={!value.classId || subjectsLoading}
          >
            <SelectTrigger data-testid="ctx-select-subject" className="h-9">
              <SelectValue placeholder={
                !value.classId             ? "Select class first" :
                subjectsLoading            ? "Loading subjects…" :
                classSubjects.length === 0 ? "No subjects for this class" :
                                             "Select subject…"
              } />
            </SelectTrigger>
            <SelectContent>
              {!subjectsLoading && classSubjects.length === 0 && value.classId ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No subjects assigned to this class
                </div>
              ) : (
                classSubjects.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Term (Cross-session filter by name) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Term
          </Label>
          <Select
            value={value.termName || "all"}
            onValueChange={(v) => {
              const termName = v as 'all' | 'first' | 'second' | 'third';
              // termId is for stamping new questions (always current term);
              // termName drives the cross-session filter
              const termId = currentTerm?.id;
              onChange({ ...value, termName, termId, bankId: undefined });
            }}
            disabled={!value.subjectId}
          >
            <SelectTrigger data-testid="ctx-select-term" className="h-9">
              <SelectValue placeholder={value.subjectId ? "Select term…" : "Select subject first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms (All Sessions)</SelectItem>
              <SelectItem value="first">First Term (All Sessions)</SelectItem>
              <SelectItem value="second">Second Term (All Sessions)</SelectItem>
              <SelectItem value="third">Third Term (All Sessions)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bank */}
        {showBank && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
              Question Bank <span className="text-destructive normal-case tracking-normal">*</span>
            </Label>
            <Select
              value={value.bankId ? String(value.bankId) : ""}
              onValueChange={(v) => onChange({ ...value, bankId: Number(v) })}
              disabled={!canLoadBanks || (canLoadBanks && !banksLoading && banks.length === 0)}
            >
              <SelectTrigger data-testid="ctx-select-bank" className="h-9">
                <SelectValue placeholder={
                  !canLoadBanks      ? "Select class & subject first" :
                  banksLoading       ? "Loading banks…" :
                  banks.length === 0 && value.termName && value.termName !== 'all' ? "No banks for this term" :
                  banks.length === 0 ? "No banks found — create one first" :
                                      "Select bank…"
                } />
              </SelectTrigger>
              <SelectContent>
                {!banksLoading && banks.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {value.termName && value.termName !== 'all'
                      ? "No banks exist for this term. Try \"All Terms\" or create a new bank."
                      : "No banks found. Create one using the \"New Bank\" button."}
                  </div>
                ) : (
                  banks.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {canLoadBanks && value.termName === 'all' && banks.length > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3 flex-shrink-0" />
                Showing banks from all sessions
              </p>
            )}
          </div>
        )}
      </div>

      {(!value.classId || !value.subjectId || !value.termName || (showBank && !value.bankId)) && (
        <div className="flex items-start gap-2 bg-primary/5 dark:bg-primary/5 border border-primary/20 dark:border-primary/30/50 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-primary dark:text-primary/60">
            All fields are required. Select <strong>Class → Subject → Term{showBank ? " → Question Bank" : ""}</strong> to load questions.
          </p>
        </div>
      )}
    </div>
  );
}
