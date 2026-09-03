# Pulse Board

A 20-file React example used to exercise `mutate4ts` on real application code: logic, hooks, and UI.

## Files

Logic

- `src/lib/priority.ts`
- `src/lib/dueDate.ts`
- `src/lib/filterTasks.ts`
- `src/lib/stats.ts`
- `src/lib/search.ts`
- `src/lib/sortTasks.ts`

Hooks

- `src/hooks/useToggle.ts`
- `src/hooks/useLocalStorage.ts`
- `src/hooks/useDebouncedValue.ts`
- `src/hooks/useTaskStats.ts`
- `src/hooks/useFilteredTasks.ts`

UI

- `src/components/Badge.tsx`
- `src/components/TaskItem.tsx`
- `src/components/TaskList.tsx`
- `src/components/TaskForm.tsx`
- `src/components/StatsBar.tsx`
- `src/components/SearchBar.tsx`
- `src/components/FilterBar.tsx`
- `src/components/EmptyState.tsx`
- `src/App.tsx`

## Run the app

```bash
cd examples/pulse-board
npm install
npm test
npm run dev
```

## Mutate it

From the repository root:

```bash
npx tsx src/cli/main.ts examples/pulse-board/src/components/Badge.tsx --scan
npx tsx src/cli/main.ts examples/pulse-board/src/lib/priority.ts --mutate-all --verbose --max-workers 2 --test-command "npx vitest run"
```
