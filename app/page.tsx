'use client'

import React, { useState, useCallback, useMemo, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  HiEnvelope,
  HiMagnifyingGlass,
  HiFunnel,
  HiChevronDown,
  HiChevronUp,
  HiArrowPath,
  HiCheck,
  HiExclamationTriangle,
  HiInboxStack,
  HiClock,
  HiStar,
  HiChartBar,
  HiArrowsUpDown,
  HiBars3,
  HiXMark,
  HiCalendarDays,
  HiUser,
  HiTag,
  HiChatBubbleBottomCenterText,
  HiCheckCircle,
  HiInformationCircle,
  HiSparkles,
  HiAdjustmentsHorizontal,
  HiBoltSlash
} from 'react-icons/hi2'

// ---------- Constants ----------
const AGENT_ID = '69a02b4c8ded04faf8347c8f'

// ---------- Theme ----------
const GRADIENT_BG = 'linear-gradient(135deg, hsl(210 20% 97%) 0%, hsl(220 25% 95%) 35%, hsl(200 20% 96%) 70%, hsl(230 15% 97%) 100%)'

// ---------- TypeScript Interfaces ----------
interface EmailSentiment {
  label: string
  score: number
}

interface AnalyzedEmail {
  id: string
  thread_id: string
  sender: string
  sender_email: string
  subject: string
  date: string
  snippet: string
  summary: string
  sentiment: EmailSentiment
  priority: string
  action_items: string[]
}

interface PrioritySummary {
  high: number
  medium: number
  low: number
}

interface AnalysisResponse {
  total_emails: number
  priority_summary: PrioritySummary
  dominant_sentiment: string
  emails: AnalyzedEmail[]
  message: string
}

interface FilterState {
  searchQuery: string
  senderEmail: string
  subjectKeyword: string
  dateFrom: string
  dateTo: string
  maxResults: number
}

type SortOption = 'priority' | 'sentiment' | 'date'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'
type AppState = 'idle' | 'loading' | 'results' | 'error'

// ---------- Sample Data ----------
const SAMPLE_DATA: AnalysisResponse = {
  total_emails: 12,
  priority_summary: { high: 3, medium: 5, low: 4 },
  dominant_sentiment: 'neutral',
  emails: [
    {
      id: '1', thread_id: 't1', sender: 'Sarah Chen', sender_email: 'sarah.chen@company.com',
      subject: 'Q4 Revenue Report - Urgent Review Needed', date: '2025-01-15T09:30:00Z',
      snippet: 'Hi team, please review the attached Q4 revenue report before our meeting tomorrow...',
      summary: 'Sarah is requesting an urgent review of the Q4 revenue report before tomorrow\'s board meeting. The report shows a 15% increase in recurring revenue but flags concerns about churn in the enterprise segment.',
      sentiment: { label: 'neutral', score: 0.6 }, priority: 'high',
      action_items: ['Review Q4 revenue report', 'Prepare comments for board meeting', 'Check enterprise churn data']
    },
    {
      id: '2', thread_id: 't2', sender: 'Marcus Johnson', sender_email: 'marcus.j@partner.io',
      subject: 'Partnership Renewal Discussion', date: '2025-01-15T08:15:00Z',
      snippet: 'Looking forward to discussing the renewal terms next week...',
      summary: 'Marcus wants to schedule a call to discuss the partnership renewal terms. He mentions favorable feedback from their leadership team and interest in expanding the scope of the partnership.',
      sentiment: { label: 'positive', score: 0.85 }, priority: 'high',
      action_items: ['Schedule renewal call', 'Prepare partnership expansion proposal', 'Review current partnership metrics']
    },
    {
      id: '3', thread_id: 't3', sender: 'Emily Watson', sender_email: 'emily.w@company.com',
      subject: 'Team Standup Notes - January 15', date: '2025-01-15T07:45:00Z',
      snippet: 'Here are the key takeaways from today\'s standup...',
      summary: 'Emily shared notes from the daily standup. Key updates include the frontend redesign being 80% complete, backend API migration on track for next sprint, and a new bug reported in the payment module.',
      sentiment: { label: 'neutral', score: 0.5 }, priority: 'medium',
      action_items: ['Review payment module bug', 'Check frontend redesign progress']
    },
    {
      id: '4', thread_id: 't4', sender: 'David Park', sender_email: 'david.park@vendor.com',
      subject: 'Invoice #4521 - Payment Overdue', date: '2025-01-14T16:30:00Z',
      snippet: 'This is a reminder that invoice #4521 is now 15 days overdue...',
      summary: 'David is following up on an overdue invoice of $12,500 for consulting services rendered in December. This is the second reminder and he mentions potential late fees if not resolved within 5 business days.',
      sentiment: { label: 'negative', score: 0.3 }, priority: 'high',
      action_items: ['Process payment for invoice #4521', 'Contact accounts payable', 'Respond to David with payment timeline']
    },
    {
      id: '5', thread_id: 't5', sender: 'Newsletter', sender_email: 'digest@techweekly.com',
      subject: 'This Week in Tech: AI Breakthroughs & Market Trends', date: '2025-01-14T06:00:00Z',
      snippet: 'Top stories this week: New language model capabilities, semiconductor market update...',
      summary: 'Weekly technology newsletter covering AI model advancements, semiconductor supply chain updates, and upcoming tech conferences. Includes a feature on enterprise AI adoption trends.',
      sentiment: { label: 'positive', score: 0.7 }, priority: 'low',
      action_items: ['Review AI adoption trends section']
    },
  ],
  message: 'Successfully analyzed 12 emails from your inbox.'
}

// ---------- Quick Filter Presets ----------
const QUICK_FILTERS = [
  { label: 'Unread', query: 'is:unread', icon: HiEnvelope },
  { label: 'Starred', query: 'is:starred', icon: HiStar },
  { label: 'Last 24h', query: 'newer_than:1d', icon: HiClock },
  { label: 'Last 7 days', query: 'newer_than:7d', icon: HiCalendarDays },
  { label: 'Important', query: 'is:important', icon: HiExclamationTriangle },
]

// ---------- Utility Functions ----------
function getSentimentColor(label: string): string {
  const l = (label ?? '').toLowerCase()
  if (l === 'positive') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (l === 'negative') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function getPriorityColor(priority: string): string {
  const p = (priority ?? '').toLowerCase()
  if (p === 'high') return 'bg-red-100 text-red-700 border-red-200'
  if (p === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

function getPriorityDotColor(priority: string): string {
  const p = (priority ?? '').toLowerCase()
  if (p === 'high') return 'bg-red-500'
  if (p === 'medium') return 'bg-amber-500'
  return 'bg-emerald-500'
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500'
  ]
  let hash = 0
  const str = name ?? ''
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// ---------- ErrorBoundary ----------
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------- Sub-Components ----------

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent?: string }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm transition-all duration-300 hover:shadow-md ${accent ?? ''}`}>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tracking-tight text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  )
}

function EmailSkeletonCard() {
  return (
    <Card className="rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmailCard({ email, onSelect }: { email: AnalyzedEmail; onSelect: (email: AnalyzedEmail) => void }) {
  const [expanded, setExpanded] = useState(false)
  const actionItems = Array.isArray(email?.action_items) ? email.action_items : []
  const sentimentLabel = email?.sentiment?.label ?? 'neutral'
  const sentimentScore = email?.sentiment?.score ?? 0
  const priorityVal = email?.priority ?? 'low'

  return (
    <Card className="rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm transition-all duration-300 hover:shadow-md group cursor-pointer" onClick={() => onSelect(email)}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${getAvatarColor(email?.sender ?? '')}`}>
            {getInitials(email?.sender ?? '')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground truncate">{email?.sender ?? 'Unknown'}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPriorityColor(priorityVal)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getPriorityDotColor(priorityVal)}`} />
                    {priorityVal?.toUpperCase?.() ?? 'LOW'}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-foreground mt-0.5 truncate">{email?.subject ?? 'No subject'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{email?.sender_email ?? ''}</p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(email?.date ?? '')}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getSentimentColor(sentimentLabel)}`}>
                  {sentimentLabel} {(sentimentScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{email?.snippet ?? ''}</p>

            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              className="flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline transition-colors"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? <HiChevronUp className="w-3.5 h-3.5" /> : <HiChevronDown className="w-3.5 h-3.5" />}
              {expanded ? 'Less' : 'More details'}
            </button>

            {expanded && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                    <HiChatBubbleBottomCenterText className="w-3.5 h-3.5 text-primary" /> Summary
                  </p>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {renderMarkdown(email?.summary ?? '')}
                  </div>
                </div>
                {actionItems.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                      <HiCheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Action Items
                    </p>
                    <ul className="space-y-1">
                      {actionItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <HiCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailPanel({ email, open, onClose }: { email: AnalyzedEmail | null; open: boolean; onClose: () => void }) {
  if (!email) return null
  const actionItems = Array.isArray(email?.action_items) ? email.action_items : []
  const sentimentLabel = email?.sentiment?.label ?? 'neutral'
  const sentimentScore = email?.sentiment?.score ?? 0
  const priorityVal = email?.priority ?? 'low'

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg backdrop-blur-[16px] bg-white/95 border-l border-white/[0.18] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold tracking-tight pr-6">{email?.subject ?? 'No subject'}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">Detailed email analysis</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-2">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-semibold ${getAvatarColor(email?.sender ?? '')}`}>
              {getInitials(email?.sender ?? '')}
            </div>
            <div>
              <p className="font-medium text-foreground">{email?.sender ?? 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{email?.sender_email ?? ''}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(priorityVal)}`}>
              <span className={`w-2 h-2 rounded-full ${getPriorityDotColor(priorityVal)}`} />
              {priorityVal?.toUpperCase?.() ?? 'LOW'} Priority
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getSentimentColor(sentimentLabel)}`}>
              {sentimentLabel} ({(sentimentScore * 100).toFixed(0)}%)
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HiCalendarDays className="w-4 h-4" />
            <span>{formatDate(email?.date ?? '')}</span>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <HiChatBubbleBottomCenterText className="w-4 h-4 text-primary" /> Snippet
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/50 p-3 rounded-lg">{email?.snippet ?? ''}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <HiSparkles className="w-4 h-4 text-primary" /> AI Summary
            </h4>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {renderMarkdown(email?.summary ?? '')}
            </div>
          </div>

          {actionItems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <HiCheckCircle className="w-4 h-4 text-emerald-500" /> Action Items ({actionItems.length})
              </h4>
              <ul className="space-y-2">
                {actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <HiCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-emerald-800">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-2">
            <p>Thread ID: {email?.thread_id ?? 'N/A'}</p>
            <p>Email ID: {email?.id ?? 'N/A'}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------- Main Page Component ----------
export default function Page() {
  // State
  const [appState, setAppState] = useState<AppState>('idle')
  const [sampleData, setSampleData] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    senderEmail: '',
    subjectKeyword: '',
    dateFrom: '',
    dateTo: '',
    maxResults: 20,
  })
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [selectedEmail, setSelectedEmail] = useState<AnalyzedEmail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null)
  const analysisContainerRef = useRef<HTMLDivElement>(null)

  // Determine data source
  const displayData: AnalysisResponse | null = sampleData ? SAMPLE_DATA : analysisData

  // Filtered and sorted emails
  const processedEmails = useMemo(() => {
    const emails = Array.isArray(displayData?.emails) ? displayData.emails : []
    let filtered = emails
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(e => (e?.priority ?? '').toLowerCase() === priorityFilter)
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
        return (order[(a?.priority ?? '').toLowerCase()] ?? 2) - (order[(b?.priority ?? '').toLowerCase()] ?? 2)
      }
      if (sortBy === 'sentiment') {
        return (b?.sentiment?.score ?? 0) - (a?.sentiment?.score ?? 0)
      }
      if (sortBy === 'date') {
        const dateA = a?.date ? new Date(a.date).getTime() : 0
        const dateB = b?.date ? new Date(b.date).getTime() : 0
        return dateB - dateA
      }
      return 0
    })
    return sorted
  }, [displayData, priorityFilter, sortBy])

  // Build message and call agent
  const handleAnalyze = useCallback(async () => {
    setAppState('loading')
    setErrorMessage('')
    setActiveAgentId(AGENT_ID)

    const parts: string[] = []
    parts.push('Fetch and analyze my recent emails.')
    if (filters.searchQuery) parts.push(`Gmail search query: "${filters.searchQuery}".`)
    if (filters.senderEmail) parts.push(`Filter by sender: ${filters.senderEmail}.`)
    if (filters.subjectKeyword) parts.push(`Subject keyword filter: "${filters.subjectKeyword}".`)
    if (filters.dateFrom) parts.push(`From date: ${filters.dateFrom}.`)
    if (filters.dateTo) parts.push(`To date: ${filters.dateTo}.`)
    parts.push(`Maximum results: ${filters.maxResults}.`)
    parts.push('For each email provide: summary, sentiment analysis (label and score), priority level (high/medium/low), and action items.')

    const message = parts.join(' ')

    try {
      const result = await callAIAgent(message, AGENT_ID)
      setActiveAgentId(null)

      if (result?.success) {
        const parsed = parseLLMJson(result?.response?.result || result?.response)
        if (parsed && !parsed?.error) {
          setAnalysisData(parsed as AnalysisResponse)
          setAppState('results')
        } else if (parsed?.emails || parsed?.total_emails !== undefined) {
          setAnalysisData(parsed as AnalysisResponse)
          setAppState('results')
        } else {
          setErrorMessage('Could not parse the analysis results. The agent may have returned an unexpected format.')
          setAppState('error')
        }
      } else {
        setErrorMessage(result?.error ?? result?.response?.message ?? 'The agent encountered an error. Please try again.')
        setAppState('error')
      }
    } catch (err) {
      setActiveAgentId(null)
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setAppState('error')
    }
  }, [filters])

  // Quick filter handler
  const handleQuickFilter = useCallback((query: string, label: string) => {
    setActiveQuickFilter(prev => prev === label ? null : label)
    setFilters(prev => ({
      ...prev,
      searchQuery: prev.searchQuery === query ? '' : query,
    }))
  }, [])

  // Reset to filter state
  const handleReset = useCallback(() => {
    setAppState('idle')
    setAnalysisData(null)
    setErrorMessage('')
    setPriorityFilter('all')
    setSortBy('priority')
  }, [])

  // Select email for detail view
  const handleSelectEmail = useCallback((email: AnalyzedEmail) => {
    setSelectedEmail(email)
    setDetailOpen(true)
  }, [])

  const prioritySummary = displayData?.priority_summary
  const totalEmails = displayData?.total_emails ?? 0
  const showResults = appState === 'results' || sampleData

  return (
    <ErrorBoundary>
      <div style={{ background: GRADIENT_BG }} className="min-h-screen font-sans tracking-tight">
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-[16px] bg-white/75 border-b border-white/[0.18] shadow-sm">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-muted transition-colors lg:hidden" aria-label="Toggle sidebar">
                <HiBars3 className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <HiEnvelope className="w-4.5 h-4.5 text-primary-foreground" />
                </div>
                <h1 className="text-base font-semibold text-foreground tracking-tight hidden sm:block">Gmail Analysis Agent</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground font-medium cursor-pointer">Sample Data</Label>
                <Switch id="sample-toggle" checked={sampleData} onCheckedChange={setSampleData} />
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium hidden sm:inline">Gmail Connected</span>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-[1440px] mx-auto flex min-h-[calc(100vh-3.5rem)]">
          {/* Sidebar */}
          <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:overflow-hidden'} fixed lg:relative inset-y-14 left-0 z-30 w-80 lg:w-80 transition-all duration-300 ease-in-out lg:shrink-0`}>
            <div className="h-full overflow-y-auto p-4 backdrop-blur-[16px] bg-white/60 border-r border-white/[0.18] lg:bg-transparent lg:border-0">
              {/* Mobile overlay close */}
              <div className="flex items-center justify-between mb-4 lg:hidden">
                <h2 className="text-sm font-semibold text-foreground">Filters</h2>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-muted" aria-label="Close sidebar">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Search Query */}
                <div className="space-y-2">
                  <Label htmlFor="search-query" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <HiMagnifyingGlass className="w-3.5 h-3.5 text-primary" /> Gmail Search Query
                  </Label>
                  <Input
                    id="search-query"
                    placeholder='e.g., from:boss@company.com'
                    value={filters.searchQuery}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="bg-white/80 border-white/30 rounded-lg text-sm"
                  />
                </div>

                {/* Quick Filters */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <HiSparkles className="w-3.5 h-3.5 text-primary" /> Quick Filters
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_FILTERS.map((qf) => {
                      const Icon = qf.icon
                      const isActive = activeQuickFilter === qf.label
                      return (
                        <button
                          key={qf.label}
                          onClick={() => handleQuickFilter(qf.query, qf.label)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-white/80 text-muted-foreground border-white/30 hover:bg-white hover:border-border'}`}
                        >
                          <Icon className="w-3 h-3" />
                          {qf.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Sender Email */}
                <div className="space-y-2">
                  <Label htmlFor="sender-email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <HiUser className="w-3.5 h-3.5 text-primary" /> Sender Email
                  </Label>
                  <Input
                    id="sender-email"
                    type="email"
                    placeholder="john@example.com"
                    value={filters.senderEmail}
                    onChange={(e) => setFilters(prev => ({ ...prev, senderEmail: e.target.value }))}
                    className="bg-white/80 border-white/30 rounded-lg text-sm"
                  />
                </div>

                {/* Subject Keyword */}
                <div className="space-y-2">
                  <Label htmlFor="subject-keyword" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <HiTag className="w-3.5 h-3.5 text-primary" /> Subject Keyword
                  </Label>
                  <Input
                    id="subject-keyword"
                    placeholder="e.g., invoice, report"
                    value={filters.subjectKeyword}
                    onChange={(e) => setFilters(prev => ({ ...prev, subjectKeyword: e.target.value }))}
                    className="bg-white/80 border-white/30 rounded-lg text-sm"
                  />
                </div>

                <Separator className="opacity-50" />

                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <HiCalendarDays className="w-3.5 h-3.5 text-primary" /> Date Range
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="date-from" className="text-[10px] text-muted-foreground">From</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="bg-white/80 border-white/30 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="date-to" className="text-[10px] text-muted-foreground">To</Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="bg-white/80 border-white/30 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Max Results */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><HiInboxStack className="w-3.5 h-3.5 text-primary" /> Max Results</span>
                    <span className="text-primary font-semibold">{filters.maxResults}</span>
                  </Label>
                  <Slider
                    value={[filters.maxResults]}
                    onValueChange={(val) => setFilters(prev => ({ ...prev, maxResults: val[0] ?? 20 }))}
                    min={5}
                    max={50}
                    step={5}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5</span>
                    <span>50</span>
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Analyze Button */}
                <Button
                  onClick={handleAnalyze}
                  disabled={appState === 'loading'}
                  className="w-full rounded-[0.875rem] font-medium h-11 text-sm shadow-md hover:shadow-lg transition-all duration-300"
                  size="lg"
                >
                  {appState === 'loading' ? (
                    <span className="flex items-center gap-2">
                      <HiArrowPath className="w-4 h-4 animate-spin" /> Analyzing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <HiMagnifyingGlass className="w-4 h-4" /> Analyze Emails
                    </span>
                  )}
                </Button>

                {showResults && (
                  <Button variant="outline" onClick={handleReset} className="w-full rounded-[0.875rem] text-sm" size="sm">
                    <HiArrowPath className="w-3.5 h-3.5 mr-1.5" /> New Analysis
                  </Button>
                )}
              </div>
            </div>
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Main Content */}
          <main className="flex-1 p-4 sm:p-6 overflow-x-hidden" ref={analysisContainerRef}>
            {/* Idle State */}
            {appState === 'idle' && !sampleData && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto text-center">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <HiEnvelope className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-2">Analyze Your Gmail Inbox</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                  Configure your filters in the sidebar and click Analyze to get AI-powered insights on your emails including sentiment analysis, priority classification, and actionable summaries.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  <div className="p-4 rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm text-center">
                    <HiChartBar className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">Sentiment Analysis</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Positive, neutral, or negative tone</p>
                  </div>
                  <div className="p-4 rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm text-center">
                    <HiExclamationTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">Priority Scoring</p>
                    <p className="text-[11px] text-muted-foreground mt-1">High, medium, low urgency</p>
                  </div>
                  <div className="p-4 rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm text-center">
                    <HiCheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">Action Items</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Extracted to-dos from emails</p>
                  </div>
                </div>
                <Button onClick={() => setSidebarOpen(true)} className="mt-6 lg:hidden rounded-[0.875rem]">
                  <HiAdjustmentsHorizontal className="w-4 h-4 mr-2" /> Open Filters
                </Button>
              </div>
            )}

            {/* Loading State */}
            {appState === 'loading' && !sampleData && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <HiArrowPath className="w-5 h-5 text-primary animate-spin" />
                  <p className="text-sm font-medium text-foreground">Analyzing your emails with AI...</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-4 rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm">
                      <Skeleton className="h-6 w-12 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <EmailSkeletonCard key={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Error State */}
            {appState === 'error' && !sampleData && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-md mx-auto text-center">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                  <HiBoltSlash className="w-8 h-8 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Analysis Failed</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{errorMessage || 'Something went wrong. Please try again.'}</p>
                <div className="flex gap-3">
                  <Button onClick={handleAnalyze} className="rounded-[0.875rem]">
                    <HiArrowPath className="w-4 h-4 mr-2" /> Retry
                  </Button>
                  <Button variant="outline" onClick={handleReset} className="rounded-[0.875rem]">Back to Filters</Button>
                </div>
              </div>
            )}

            {/* Results State */}
            {showResults && displayData && (
              <div className="space-y-5">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Emails" value={totalEmails} icon={<HiInboxStack className="w-5 h-5" />} />
                  <StatCard label="High Priority" value={prioritySummary?.high ?? 0} icon={<HiExclamationTriangle className="w-5 h-5" />} />
                  <StatCard label="Medium Priority" value={prioritySummary?.medium ?? 0} icon={<HiClock className="w-5 h-5" />} />
                  <StatCard label="Low Priority" value={prioritySummary?.low ?? 0} icon={<HiCheckCircle className="w-5 h-5" />} />
                </div>

                {/* Sentiment + Message Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[0.875rem] backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <HiChartBar className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Dominant Sentiment:</span>
                      <Badge variant="secondary" className={`text-xs ${getSentimentColor(displayData?.dominant_sentiment ?? 'neutral')}`}>
                        {displayData?.dominant_sentiment ?? 'neutral'}
                      </Badge>
                    </div>
                  </div>
                  {displayData?.message && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <HiInformationCircle className="w-3.5 h-3.5 shrink-0" />
                      {displayData.message}
                    </p>
                  )}
                </div>

                {/* Sort & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <HiFunnel className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Filter by:</span>
                    {(['all', 'high', 'medium', 'low'] as PriorityFilter[]).map(pf => (
                      <button
                        key={pf}
                        onClick={() => setPriorityFilter(pf)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 ${priorityFilter === pf ? 'bg-primary text-primary-foreground border-primary' : 'bg-white/80 text-muted-foreground border-white/30 hover:bg-white hover:border-border'}`}
                      >
                        {pf === 'all' ? 'All' : pf.charAt(0).toUpperCase() + pf.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <HiArrowsUpDown className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Sort by:</span>
                    <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                      <SelectTrigger className="w-[130px] h-8 text-xs bg-white/80 border-white/30 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="sentiment">Sentiment</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Email Cards */}
                {processedEmails.length > 0 ? (
                  <div className="space-y-3">
                    {processedEmails.map((email) => (
                      <EmailCard key={email?.id ?? Math.random().toString()} email={email} onSelect={handleSelectEmail} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <HiInboxStack className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No emails match the current filter</p>
                    <p className="text-xs text-muted-foreground mt-1">Try selecting a different priority level above</p>
                    <Button variant="outline" onClick={() => setPriorityFilter('all')} className="mt-3 rounded-[0.875rem] text-xs" size="sm">
                      Show All
                    </Button>
                  </div>
                )}

                {/* Results Count */}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing {processedEmails.length} of {Array.isArray(displayData?.emails) ? displayData.emails.length : 0} analyzed emails
                </p>
              </div>
            )}

            {/* Agent Info */}
            <div className="mt-8 mb-4">
              <Card className="rounded-[0.875rem] backdrop-blur-[16px] bg-white/50 border border-white/[0.18] shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <HiSparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Gmail Analysis Agent</p>
                        <p className="text-[10px] text-muted-foreground">Fetches, summarizes, and classifies emails with sentiment and priority analysis</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${activeAgentId ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="text-[10px] text-muted-foreground font-medium">{activeAgentId ? 'Processing' : 'Ready'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>

        {/* Detail Sheet */}
        <DetailPanel email={selectedEmail} open={detailOpen} onClose={() => setDetailOpen(false)} />
      </div>
    </ErrorBoundary>
  )
}
