"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Home, Search, Briefcase, FileText, Bookmark, Send, BookOpen, Check, CheckCheck } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { useToast } from "@/hooks/use-toast"
import { useEvents } from "@/hooks/use-events"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: false },
]

type Conversation = { peerId: string; peer: { id: string; name: string; email: string; avatar: string }; peerPresenceOnline?: boolean; lastMessage?: { id: string; senderId: string; recipientId: string; content: string; createdAt: string }; unread: number }
type Message = { id: string; senderId: string; recipientId: string; content: string; createdAt: string; readAt?: string | null }

export default function MessagesPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPeerId, setSelectedPeerId] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [messageInput, setMessageInput] = useState("")
  const [sseReady, setSseReady] = useState(false)
  const { toast } = useToast()
  const [newEmail, setNewEmail] = useState("")
  const [starting, setStarting] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; email: string; avatar?: string; role?: string }>>([])
  const [suggesting, setSuggesting] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const selectedConversation = useMemo(() => conversations.find(c => c.peerId === selectedPeerId) || conversations[0], [conversations, selectedPeerId])

  // Preselect peerId from URL
  useEffect(() => {
    const q = searchParams?.get('peerId')
    const email = searchParams?.get('email')
    if (q) setSelectedPeerId(String(q))
    else if (email) {
      (async () => {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
          const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(email)}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data?.ok && data?.user?.id) {
            setSelectedPeerId(String(data.user.id))
            await loadMessages(String(data.user.id))
            await markRead(String(data.user.id))
          }
        } catch {}
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadConversations(peerId?: string) {
    try {
      setLoadingConv(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const qs = peerId ? `?peerId=${encodeURIComponent(peerId)}` : ''
      const res = await fetch(`/api/conversations${qs}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setConversations(data.conversations || [])
        if (!selectedPeerId && data.conversations?.[0]?.peerId) setSelectedPeerId(String(data.conversations[0].peerId))
      }
    } finally {
      setLoadingConv(false)
    }
  }

  // Mark messages from peer as read
  async function markRead(peerId: string) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      if (!token) return
      await fetch(`/api/messages/${encodeURIComponent(peerId)}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
    } catch {}
  }
  // (E2E key management and attachments removed in this iteration)

  // Start new conversation by email or name (seeker -> employer)
  const handleStartConversation = async () => {
    const term = newEmail.trim()
    if (!term) return
    try {
      setStarting(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const looksLikeEmail = term.includes('@')
      if (looksLikeEmail) {
        const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(term)}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.ok || !data?.user?.id) throw new Error(data?.error || 'User not found')
        setSelectedPeerId(String(data.user.id))
        await Promise.all([loadMessages(String(data.user.id)), loadConversations(String(data.user.id))])
        setNewEmail("")
        return
      }
      // Not an email: try first suggestion (name search)
      if (suggestions.length > 0) {
        const top = suggestions[0]
        await pickSuggestion(top as any)
        await loadConversations(String((top as any).id))
        return
      }
      // Force a suggestions fetch then try again
      const res = await fetch(`/api/users/lookup?q=${encodeURIComponent(term)}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
      const data = await res.json().catch(() => ({}))
      const list = Array.isArray(data?.suggestions) ? data.suggestions : []
      if (list.length > 0) {
        await pickSuggestion(list[0])
        await loadConversations(String(list[0].id))
        return
      }
      throw new Error('No matching employers found. Try refining the name or use an email address.')
    } catch (err: any) {
      toast({ description: err?.message || 'Failed to find user', variant: 'destructive' })
    } finally {
      setStarting(false)
    }
  }

  async function loadMessages(peerId: string) {
    if (!peerId) return
    try {
      setLoadingMsgs(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/messages/${encodeURIComponent(peerId)}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
      const data = await res.json()
      if (res.ok && data?.ok) setMessages(data.messages || [])
      else throw new Error(data?.error || 'Failed to load messages')
    } finally {
      setLoadingMsgs(false)
    }
  }

  useEffect(() => {
    loadConversations().catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedPeerId) {
      loadMessages(selectedPeerId).then(() => markRead(selectedPeerId)).catch(() => {})
    }
  }, [selectedPeerId])

  // SSE via useEvents
  useEvents({
    events: ['message.created', 'message.read', 'user.updated'],
    onEvent: (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data || '{}')
        if (data?.type === 'message.created') {
          loadConversations().catch(() => {})
          if (selectedPeerId && (data?.payload?.senderId === selectedPeerId || data?.payload?.recipientId === selectedPeerId)) {
            loadMessages(selectedPeerId).then(() => markRead(selectedPeerId)).catch(() => {})
          }
          setSseReady(true)
        }
        if (data?.type === 'message.read') {
          // Refresh conversations
          loadConversations().catch(() => {})
          // If current thread is open, refresh messages to update seen ticks
          if (selectedPeerId) {
            loadMessages(selectedPeerId).catch(() => {})
          }
        }
        if (data?.type === 'user.updated') {
          // If the updated user is our current peer, refresh conversations to get presence
          const updatedId = data?.payload?.id
          if (updatedId && (updatedId === selectedPeerId)) {
            loadConversations().catch(() => {})
          }
        }
      } catch {}
    }
  })

  const handleSendMessage = async () => {
    if (!selectedPeerId) {
      toast({ description: 'Select a conversation or start one by email first.', variant: 'destructive' })
      return
    }
    if (!messageInput.trim()) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
    const res = await fetch(`/api/messages/${encodeURIComponent(selectedPeerId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ content: messageInput.trim() })
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.ok) {
      setMessageInput("")
      await Promise.all([loadMessages(selectedPeerId), loadConversations()])
      await markRead(selectedPeerId)
    } else if (res.status === 403) {
      toast({ description: data?.error || 'Messaging is restricted to employers and job seekers only.', variant: 'destructive' })
    } else {
      toast({ description: data?.error || 'Failed to send message', variant: 'destructive' })
    }
  }

  // Suggestions: debounce against /api/users/lookup?q=
  useEffect(() => {
    let alive = true
    const term = newEmail.trim()
    if (!term) { setSuggestions([]); setShowSuggest(false); return }
    setSuggesting(true)
    const t = setTimeout(async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        const res = await fetch(`/api/users/lookup?q=${encodeURIComponent(term)}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (res.ok && data?.ok) {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
          setShowSuggest(true)
        } else {
          setSuggestions([])
          setShowSuggest(false)
        }
      } catch {
        if (alive) { setSuggestions([]); setShowSuggest(false) }
      } finally {
        if (alive) setSuggesting(false)
      }
    }, 200)
    return () => { alive = false; clearTimeout(t) }
  }, [newEmail])

  const pickSuggestion = async (u: { id: string; email: string }) => {
    try {
      setSelectedPeerId(String(u.id))
      await loadMessages(String(u.id))
      await markRead(String(u.id))
      setShowSuggest(false)
      setSuggestions([])
      setNewEmail(u.email)
    } catch {}
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col gap-2">
            <PageHeader
              title="Messages"
              description="Communicate with employers about your applications"
            />
          </div>

          {/* Start New Conversation */}
          <div className="relative flex items-center gap-2 max-w-2xl">
            <div className="flex-1">
              <Input
                placeholder="Type employer email or name"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onFocus={() => { if (suggestions.length) setShowSuggest(true) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartConversation() }}
                className="max-w-full"
              />
              {showSuggest && (suggestions.length > 0) && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow">
                  <div className="max-h-64 overflow-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => pickSuggestion(s)}
                        className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted">{(s.name || s.email || 'U').charAt(0).toUpperCase()}</span>
                        <span className="text-sm">
                          <span className="font-medium">{s.name || s.email}</span>
                          <span className="block text-xs text-muted-foreground">{s.email}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button variant="outline" onClick={handleStartConversation} disabled={starting || !newEmail.trim()}>
              {starting ? 'Starting…' : 'Start'}
            </Button>
          </div>

          {/* Messages Interface */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-3 h-[600px]">
                {/* Conversations List */}
                <div className="border-r border-border overflow-y-auto">
                  <div className="p-4 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search conversations..." className="pl-10" />
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {(loadingConv ? [] : conversations).map((conversation) => (
                      <button
                        key={conversation.peerId}
                        onClick={() => setSelectedPeerId(conversation.peerId)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          (selectedConversation?.peerId === conversation.peerId) ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={conversation.peer?.avatar || "/placeholder.svg"} alt={conversation.peer?.name} />
                            <AvatarFallback>{(conversation.peer?.name || 'U').charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold text-foreground text-sm truncate">{conversation.peer?.name || 'User'}</h3>
                              {Number(conversation.unread || 0) > 0 && (
                                <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5">
                                  {Number(conversation.unread || 0)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{conversation.lastMessage?.content || ''}</p>
                            <p className="text-xs text-muted-foreground mt-1">{conversation.lastMessage?.createdAt ? new Date(conversation.lastMessage.createdAt).toLocaleString() : ''}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Area */}
                <div className="md:col-span-2 flex flex-col">
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={selectedConversation?.peer?.avatar || "/placeholder.svg"}
                          alt={selectedConversation?.peer?.name || 'User'}
                        />
                        <AvatarFallback>{(selectedConversation?.peer?.name || 'U').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-foreground">{selectedConversation?.peer?.name || 'User'}</h3>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${selectedConversation?.peerPresenceOnline ? 'bg-green-500' : 'bg-muted-foreground/50'}`}></span>
                          {selectedConversation?.peerPresenceOnline ? 'Online' : 'Offline'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedPeerId && (
                      <div className="text-sm text-muted-foreground">
                        Start by selecting a conversation on the left, or enter an email above and click Start.
                      </div>
                    )}
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderId && selectedConversation?.peer?.id && (message.senderId !== selectedConversation.peer.id) ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            (message.senderId && selectedConversation?.peer?.id && (message.senderId !== selectedConversation.peer.id))
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-xs ${
                              (message.senderId && selectedConversation?.peer?.id && (message.senderId !== selectedConversation.peer.id)) ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}>
                              {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {/* Status ticks for messages I sent */}
                            {(selectedConversation?.peer?.id && message.senderId !== selectedConversation.peer.id) ? (
                              message.readAt ? (
                                <CheckCheck className="h-3.5 w-3.5 text-job-blue-600 dark:text-job-blue-400" />
                              ) : (
                                <Check className="h-3.5 w-3.5 opacity-70" />
                              )
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-border">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Type your message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendMessage()
                          }}
                          className="resize-none"
                          disabled={!selectedPeerId}
                        />
                      </div>
                      <Button onClick={handleSendMessage} disabled={!selectedPeerId}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
