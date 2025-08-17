import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Sun, Moon, Trash2, Edit3, CheckCircle2, Filter, SortAsc, Download, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { differenceInDays, format, isBefore, parseISO } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import clsx from 'clsx'

export type Priority = 'Low' | 'Medium' | 'High'

export interface Goal {
  id: string
  title: string
  description: string
  deadline: string
  priority: Priority
  steps: number
  completedSteps: number
  completed: boolean
  createdAt: number
  completedAt?: number
}

type FilterKey = 'all' | 'active' | 'completed'

type SortKey = 'created-desc' | 'deadline-asc' | 'deadline-desc' | 'priority-desc' | 'priority-asc'

const STORAGE_KEY = 'life_goals_v1'
const THEME_KEY = 'theme'

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      const stored = localStorage.getItem(THEME_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {}
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {}
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}

function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Goal[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveGoals(goals: Goal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
  } catch {}
}

function priorityOrder(p: Priority): number {
  if (p === 'High') return 3
  if (p === 'Medium') return 2
  return 1
}

function daysUntil(deadlineIso: string): number {
  const today = new Date()
  return differenceInDays(parseISO(deadlineIso), today)
}

function isOverdue(deadlineIso: string): boolean {
  return isBefore(parseISO(deadlineIso), new Date())
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-2 rounded bg-gray-200 dark:bg-gray-800 overflow-hidden">
      <div className="h-2 bg-primary-600 dark:bg-primary-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

function Stats({ goals }: { goals: Goal[] }) {
  const total = goals.length
  const completed = goals.filter(g => g.completed).length
  const pending = total - completed
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="text-sm text-gray-500">Total Goals</div>
        <div className="text-2xl font-semibold mt-1">{total}</div>
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="text-sm text-gray-500">Completed</div>
        <div className="text-2xl font-semibold mt-1 text-green-600">{completed}</div>
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="text-sm text-gray-500">Pending</div>
        <div className="text-2xl font-semibold mt-1 text-amber-600">{pending}</div>
      </div>
    </div>
  )
}

function QuoteCard() {
  const quotes = useMemo(
    () => [
      'The secret of getting ahead is getting started. — Mark Twain',
      'It always seems impossible until it’s done. — Nelson Mandela',
      'Well begun is half done. — Aristotle',
      'Dream big. Start small. Act now.',
      'Action is the foundational key to all success. — Pablo Picasso',
      'Small progress is still progress.',
      'Your future is created by what you do today, not tomorrow. — Robert Kiyosaki',
      'You don’t have to be great to start, but you have to start to be great. — Zig Ziglar',
    ],
    []
  )
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * quotes.length))
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % quotes.length), 10000)
    return () => clearInterval(id)
  }, [quotes.length])
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-primary-50 to-white dark:from-gray-900 dark:to-gray-900 p-4">
      <div className="text-sm text-gray-500">Motivation</div>
      <div className="mt-1 text-gray-900 dark:text-gray-100">{quotes[idx]}</div>
    </div>
  )
}

function useGoalsState() {
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals())
  useEffect(() => {
    saveGoals(goals)
  }, [goals])
  return { goals, setGoals }
}

function GoalForm({ initial, onCancel, onSave }: { initial?: Partial<Goal>; onCancel: () => void; onSave: (goal: Goal) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [deadline, setDeadline] = useState(() => {
    if (initial?.deadline) return initial.deadline
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'Medium')
  const [steps, setSteps] = useState<number>(initial?.steps ?? 1)
  const isEditing = Boolean(initial && (initial as Goal).id)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const base: Goal = {
      id: isEditing ? (initial as Goal).id : uuidv4(),
      title: title.trim(),
      description: description.trim(),
      deadline: new Date(deadline).toISOString(),
      priority,
      steps: Math.max(1, Math.round(Number(steps) || 1)),
      completedSteps: initial?.completedSteps ?? 0,
      completed: initial?.completed ?? false,
      createdAt: isEditing ? (initial as Goal).createdAt! : Date.now(),
      completedAt: initial?.completedAt,
    }
    onSave(base)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Goal title" className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What does success look like?" className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deadline</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500">
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Steps</label>
          <input type="number" min={1} value={steps} onChange={e => setSteps(Number(e.target.value))} className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
        <button type="submit" className="px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700">{isEditing ? 'Save Changes' : 'Add Goal'}</button>
      </div>
    </form>
  )
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92vw] max-w-2xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-lg animate-in fade-in zoom-in">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>
        <div className="pt-3">{children}</div>
      </div>
    </div>
  )
}

function Toast({ open, message, onUndo }: { open: boolean; message: string; onUndo: () => void }) {
  if (!open) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 rounded-full border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-4 py-2 shadow-lg">
        <span>{message}</span>
        <button onClick={onUndo} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-sm"><Undo2 size={16} /> Undo</button>
      </div>
    </div>
  )
}

function GoalCard({ goal, onToggleComplete, onIncrementStep, onDecrementStep, onEdit, onDelete }: {
  goal: Goal
  onToggleComplete: (g: Goal) => void
  onIncrementStep: (g: Goal) => void
  onDecrementStep: (g: Goal) => void
  onEdit: (g: Goal) => void
  onDelete: (g: Goal) => void
}) {
  const remainingDays = daysUntil(goal.deadline)
  const overdue = isOverdue(goal.deadline)
  const showProgress = goal.steps > 1
  const progress = showProgress ? Math.round((goal.completedSteps / goal.steps) * 100) : goal.completed ? 100 : 0

  return (
    <div className={clsx(
      'group relative rounded-lg border bg-white dark:bg-gray-900 p-4 shadow-sm transition-all',
      'border-gray-200 dark:border-gray-800',
      goal.completed ? 'ring-1 ring-green-500/50' : 'hover:shadow-md'
    )}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={goal.completed} onChange={() => onToggleComplete(goal)} className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-600" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={clsx('text-lg font-semibold', goal.completed && 'line-through text-gray-400 dark:text-gray-500')}>{goal.title}</h3>
            <div className="flex items-center gap-1 text-xs">
              <span className={clsx('px-2 py-0.5 rounded-full border',
                goal.priority === 'High' && 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300',
                goal.priority === 'Medium' && 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300',
                goal.priority === 'Low' && 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
              )}>{goal.priority}</span>
            </div>
          </div>
          <p className={clsx('mt-1 text-sm text-gray-600 dark:text-gray-300', goal.completed && 'line-through text-gray-400 dark:text-gray-500')}>{goal.description}</p>

          {showProgress && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span>{goal.completedSteps}/{goal.steps} ({progress}%)</span>
              </div>
              <div className="mt-1">
                <ProgressBar value={progress} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => onDecrementStep(goal)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"><ChevronLeft size={16} /> Step</button>
                <button onClick={() => onIncrementStep(goal)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Step <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className={clsx('text-sm font-medium',
              overdue && !goal.completed && 'text-red-600',
              !overdue && remainingDays <= 3 && 'text-amber-600',
              remainingDays > 3 && 'text-gray-500'
            )}>
              {goal.completed ? (
                <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={16} /> Completed {goal.completedAt ? `on ${format(goal.completedAt, 'MMM d, yyyy')}` : ''}</span>
              ) : (
                <span>{overdue ? 'Overdue' : `${remainingDays} day${Math.abs(remainingDays) === 1 ? '' : 's'} ${remainingDays >= 0 ? 'left' : 'ago'}`}</span>
              )}
            </div>
            <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(goal)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"><Edit3 size={16} /> Edit</button>
              <button onClick={() => onDelete(goal)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { theme, toggle } = useTheme()
  const { goals, setGoals } = useGoalsState()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sortBy, setSortBy] = useState<SortKey>('created-desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [undoOpen, setUndoOpen] = useState(false)
  const undoTimerRef = useRef<number | null>(null)
  const lastToggledRef = useRef<Goal | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const filteredGoals = useMemo(() => {
    let list = [...goals]
    if (filter === 'active') list = list.filter(g => !g.completed)
    if (filter === 'completed') list = list.filter(g => g.completed)
    switch (sortBy) {
      case 'deadline-asc':
        list.sort((a, b) => parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime())
        break
      case 'deadline-desc':
        list.sort((a, b) => parseISO(b.deadline).getTime() - parseISO(a.deadline).getTime())
        break
      case 'priority-desc':
        list.sort((a, b) => priorityOrder(b.priority) - priorityOrder(a.priority))
        break
      case 'priority-asc':
        list.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
        break
      default:
        list.sort((a, b) => b.createdAt - a.createdAt)
    }
    return list
  }, [goals, filter, sortBy])

  function handleAddNew() {
    setEditing(null)
    setIsModalOpen(true)
  }

  function handleSave(goal: Goal) {
    setGoals(prev => {
      const exists = prev.some(g => g.id === goal.id)
      if (exists) return prev.map(g => (g.id === goal.id ? goal : g))
      return [goal, ...prev]
    })
    setIsModalOpen(false)
    setEditing(null)
  }

  function handleEdit(goal: Goal) {
    setEditing(goal)
    setIsModalOpen(true)
  }

  function handleDelete(goal: Goal) {
    const ok = window.confirm('Delete this goal? This cannot be undone.')
    if (!ok) return
    setGoals(prev => prev.filter(g => g.id !== goal.id))
  }

  function handleToggleComplete(goal: Goal) {
    const updated = { ...goal, completed: !goal.completed, completedAt: !goal.completed ? Date.now() : undefined }
    setGoals(prev => prev.map(g => (g.id === goal.id ? updated : g)))
    lastToggledRef.current = goal
    setUndoOpen(true)
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current)
    undoTimerRef.current = window.setTimeout(() => setUndoOpen(false), 5000)
  }

  function handleUndo() {
    const last = lastToggledRef.current
    if (!last) return
    setGoals(prev => prev.map(g => (g.id === last.id ? last : g)))
    setUndoOpen(false)
    lastToggledRef.current = null
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current)
  }

  function handleIncrementStep(goal: Goal) {
    if (goal.completed) return
    if (goal.completedSteps >= goal.steps) return
    const updated = { ...goal, completedSteps: goal.completedSteps + 1 }
    setGoals(prev => prev.map(g => (g.id === goal.id ? updated : g)))
  }

  function handleDecrementStep(goal: Goal) {
    if (goal.completed) return
    if (goal.completedSteps <= 0) return
    const updated = { ...goal, completedSteps: goal.completedSteps - 1 }
    setGoals(prev => prev.map(g => (g.id === goal.id ? updated : g)))
  }

  async function handleExportPDF() {
    if (!contentRef.current) return
    const element = contentRef.current
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: theme === 'dark' ? '#0a0a0a' : '#ffffff' })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF('p', 'pt', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save('goals.pdf')
  }

  return (
    <div className="h-full">
      <div className="flex h-full">
        <aside className="hidden md:flex md:w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="text-xl font-semibold">Life Goals</div>
          <nav className="mt-6 space-y-1">
            <button onClick={() => setFilter('all')} className={clsx('w-full text-left px-3 py-2 rounded-md', filter === 'all' ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800')}>Dashboard</button>
            <button onClick={() => setFilter('active')} className={clsx('w-full text-left px-3 py-2 rounded-md', filter === 'active' ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800')}>Active</button>
            <button onClick={() => setFilter('completed')} className={clsx('w-full text-left px-3 py-2 rounded-md', filter === 'completed' ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800')}>Completed</button>
          </nav>
          <div className="mt-auto">
            <div className="pt-4"><QuoteCard /></div>
          </div>
        </aside>
        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button className="md:hidden inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1">☰</button>
                  <div className="text-lg font-semibold">Dashboard</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleAddNew} className="inline-flex items-center gap-2 rounded-md bg-primary-600 text-white px-3 py-2 hover:bg-primary-700"><Plus size={18} /> Add Goal</button>
                  <button onClick={handleExportPDF} className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"><Download size={18} /> Export PDF</button>
                  <button onClick={toggle} aria-label="Toggle theme" className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-4 py-6 space-y-6" ref={contentRef}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 space-y-4">
                <Stats goals={goals} />

                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
                    <button onClick={() => setFilter('all')} className={clsx('px-3 py-2 text-sm', filter === 'all' ? 'bg-primary-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800')}>All</button>
                    <button onClick={() => setFilter('active')} className={clsx('px-3 py-2 text-sm', filter === 'active' ? 'bg-primary-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800')}>Active</button>
                    <button onClick={() => setFilter('completed')} className={clsx('px-3 py-2 text-sm', filter === 'completed' ? 'bg-primary-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800')}>Completed</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm text-gray-600 dark:text-gray-300"><Filter size={16} /> Filter: {filter}</div>
                    <div className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm">
                      <SortAsc size={16} />
                      <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="bg-transparent border-0 focus:ring-0">
                        <option value="created-desc">Newest</option>
                        <option value="deadline-asc">Deadline ↑</option>
                        <option value="deadline-desc">Deadline ↓</option>
                        <option value="priority-desc">Priority High→Low</option>
                        <option value="priority-asc">Priority Low→High</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredGoals.map(g => (
                    <GoalCard key={g.id} goal={g} onToggleComplete={handleToggleComplete} onIncrementStep={handleIncrementStep} onDecrementStep={handleDecrementStep} onEdit={handleEdit} onDelete={handleDelete} />
                  ))}
                  {filteredGoals.length === 0 && (
                    <div className="col-span-full rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500">
                      No goals here yet. Click "Add Goal" to create one.
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-1 space-y-4">
                <QuoteCard />
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                  <div className="text-sm text-gray-500">Tips</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <li>Use steps for multi-part goals to track partial progress.</li>
                    <li>Sort by deadline to keep urgent goals on top.</li>
                    <li>Export a PDF snapshot for weekly reviews.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'Edit Goal' : 'Add Goal'}>
        <GoalForm initial={editing ?? undefined} onCancel={() => { setIsModalOpen(false); setEditing(null) }} onSave={handleSave} />
      </Modal>

      <Toast open={undoOpen} message="Marked complete. Undo?" onUndo={handleUndo} />
    </div>
  )
}
