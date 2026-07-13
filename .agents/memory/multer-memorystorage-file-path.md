---
name: Multer memoryStorage + req.file.path bug pattern
description: A shared multer instance using memoryStorage() has no req.file.path — any route reading fs.readFile(req.file.path) always throws and 500s. Check this whenever CSV/file upload routes fail.
---

If a multer instance is configured with `multer.memoryStorage()`, uploaded files
only exist as `req.file.buffer` (a Buffer) — there is no temp file on disk, so
`req.file.path` is `undefined`. Any route handler that does
`fs.readFile(req.file.path, ...)` or `fs.unlink(req.file.path)` will throw
`ERR_INVALID_ARG_TYPE` and the request 500s, every single time, regardless of
the uploaded content.

**Why:** In this project (Treasure-Home School), a single `storage_multer =
multer.memoryStorage()` instance is reused across many upload routes in
`server/routes.ts` (CSV question upload, bulk user CSV import, admin CSV
preview endpoints, image uploads). Several of these routes were written
assuming disk storage and called `fs.readFile(req.file.path)`. The bug is
easy to miss because TypeScript doesn't flag it (`req.file.path` is typed as
`string | undefined` and the code doesn't null-check) and the route "looks
right" — it only breaks at runtime, on the very first real upload attempt.

**How to apply:** When a file-upload endpoint fails with a path/undefined
error, or when auditing/fixing any multer-based route, grep the whole file for
`req.file.path` and `req.file?.path` and confirm which multer `storage` engine
backs that route. If it's memoryStorage, switch to
`req.file.buffer.toString('utf-8')` (or use the buffer directly for binary)
and delete any `fs.unlink(req.file.path)` cleanup calls — there is nothing to
unlink.

Separately, in this codebase there are two independent CSV-upload code paths
for exam/question-bank questions: (1) `/api/exams/:examId/questions/csv` on
the server parses the raw CSV file server-side (via `csv-parse`) and is not
currently called by any client component — it's an orphaned-but-real API; (2)
the actual UI flow (`ExamManagement.tsx`, `BulkCSVQuestionsDialog.tsx`) parses
the CSV client-side with `client/src/lib/csvParser.ts` and POSTs already-parsed
JSON to `/api/exam-questions/bulk` or `/api/question-bank/items/bulk-csv`.
The two paths expect different CSV header spellings (server wants
`questiontext`/`questiontype`; client template uses `QuestionText`/`Type`) —
don't assume fixing one path fixes the other, and test whichever endpoint is
actually wired to the UI before declaring an upload bug fixed.
