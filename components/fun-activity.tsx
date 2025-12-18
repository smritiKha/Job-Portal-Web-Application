"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

function formatYMD(d: Date) {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}${m}${day}`
}

function TypingSpeed() {
  const WORDS = useMemo(() => [
    'react','next','mongo','docker','kubernetes','python','node','typescript','database','server',
    'client','async','await','function','variable','constant','script','deploy','testing','design',
    'frontend','backend','fullstack','component','state','effect','router','layout','context','hook'
  ], [])

  const DURATION = 30 // seconds
  const [timeLeft, setTimeLeft] = useState<number>(DURATION)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState('')
  const [correct, setCorrect] = useState(0)
  const [incorrect, setIncorrect] = useState(0)
  const [charsTyped, setCharsTyped] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let t: any
    if (started && !finished && timeLeft > 0) {
      t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    }
    if (timeLeft === 0 && started && !finished) {
      setFinished(true)
    }
    return () => clearTimeout(t)
  }, [started, finished, timeLeft])

  const start = () => {
    setStarted(true)
    setFinished(false)
    setTimeLeft(DURATION)
    setCurrentIndex(0)
    setInput('')
    setCorrect(0)
    setIncorrect(0)
    setCharsTyped(0)
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  const onType = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!started) setStarted(true)
    const v = e.target.value
    setInput(v)
    setCharsTyped((c) => c + 1)
    if (v.endsWith(' ')) {
      const word = v.trim()
      if (word.length) {
        if (normalize(word) === normalize(WORDS[currentIndex % WORDS.length])) setCorrect((c) => c + 1)
        else setIncorrect((c) => c + 1)
        setCurrentIndex((i) => i + 1)
      }
      setInput('')
    }
  }

  const wpm = useMemo(() => {
    const minutes = (DURATION - timeLeft) / 60
    if (minutes <= 0) return 0
    return Math.round((correct) / minutes)
  }, [correct, timeLeft])

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Type the words as fast as you can</div>
        <div className="text-sm">Time: <span className="font-medium">{timeLeft}s</span></div>
      </div>
      <div className="p-3 rounded-lg border bg-muted/30 min-h-[72px]">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 20 }).map((_, i) => {
            const idx = (currentIndex + i) % WORDS.length
            return (
              <span key={i} className={`px-2 py-1 rounded-md text-sm ${i===0 ? 'bg-primary/10 text-primary' : 'bg-background border'}`}>{WORDS[idx]}</span>
            )
          })}
        </div>
      </div>
      <Input
        ref={inputRef}
        value={input}
        onChange={onType}
        disabled={finished}
        placeholder={started ? 'Type here and hit space after each word' : 'Press Start and begin typing...'}
      />
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span>WPM: <span className="font-medium">{wpm}</span></span>
          <span>Correct: <span className="font-medium text-green-600">{correct}</span></span>
          <span>Wrong: <span className="font-medium text-destructive">{incorrect}</span></span>
          <span>Chars: <span className="font-medium">{charsTyped}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={start}>{started ? 'Restart' : 'Start'}</Button>
        </div>
      </div>
      {finished && (
        <div className="text-sm text-muted-foreground">
          Time's up! Your score: <span className="font-medium">{wpm} WPM</span>. Keep practicing!
        </div>
      )}
    </div>
  )
}

export function FunActivity() {
  const [tab, setTab] = useState<'quiz'|'memory'|'typing'>('quiz')

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle className="text-xl">Take a quick break</CardTitle>
          <CardDescription>Daily quiz or a tiny memory game — just for fun!</CardDescription>
        </div>
        <div className="inline-flex rounded-md border p-1 bg-background">
          <Button size="sm" variant={tab==='quiz'? 'default':'ghost'} onClick={() => setTab('quiz')}>Daily Quiz</Button>
          <Button size="sm" variant={tab==='memory'? 'default':'ghost'} onClick={() => setTab('memory')}>Emoji Match</Button>
          <Button size="sm" variant={tab==='typing'? 'default':'ghost'} onClick={() => setTab('typing')}>Typing Test</Button>
        </div>
      </CardHeader>
      <CardContent>
        {tab === 'quiz' ? <DailyQuiz /> : tab === 'memory' ? <EmojiMemory /> : <TypingSpeed />}
      </CardContent>
    </Card>
  )
}

function DailyQuiz() {
  const categories = [
    { id: 'tech', label: 'Technology' },
    { id: 'math', label: 'Math' },
    { id: 'science', label: 'Science' },
    { id: 'business', label: 'Business' },
    { id: 'general', label: 'General' },
  ] as const
  type CatId = typeof categories[number]['id']
  const [cat, setCat] = useState<CatId>('tech')
  const todayKey = useMemo(() => `quiz_done_${formatYMD(new Date())}_${cat}`, [cat])
  const [done, setDone] = useState<boolean>(false)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<'correct'|'wrong'|null>(null)

  const q = useMemo(() => getQuestionOfTheDay(cat), [cat])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const v = localStorage.getItem(todayKey)
    setDone(v === '1')
  }, [todayKey])

  const submit = () => {
    const right = normalize(answer) === normalize(q.answer)
    setResult(right ? 'correct' : 'wrong')
    if (right && typeof window !== 'undefined') {
      localStorage.setItem(todayKey, '1')
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium">You’ve completed today’s quiz 🎉</div>
          <div className="text-sm text-muted-foreground">Come back tomorrow for a new one.</div>
        </div>
        <Badge variant="secondary">Done</Badge>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Question of the day</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Category:</span>
          <select
            value={cat}
            onChange={(e) => { setAnswer(''); setResult(null); setCat(e.target.value as CatId) }}
            className="border rounded-md bg-background px-2 py-1"
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div className="font-medium">{q.question}</div>
      {q.choices && q.choices.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {q.choices.map((c, i) => (
            <Button key={i} variant={answer===c? 'default':'outline'} onClick={() => setAnswer(c)}>{c}</Button>
          ))}
        </div>
      ) : (
        <Input placeholder="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      )}
      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={!answer}>Submit</Button>
        {result === 'correct' && <span className="text-sm text-green-600">Correct! ✔️</span>}
        {result === 'wrong' && <span className="text-sm text-destructive">Not quite. Try again.</span>}
      </div>
    </div>
  )
}

function normalize(s: string) {
  return (s || '').trim().toLowerCase()
}

function getQuestionOfTheDay(category: 'tech'|'math'|'science'|'business'|'general') {
  const pools: Record<string, Array<{ question: string; answer: string; choices?: string[] }>> = {
    tech: [
      { question: 'What does HTTP stand for?', answer: 'hypertext transfer protocol', choices: ['HyperText Transfer Protocol','Hyperlink Transit Process','Host Transfer Protocol','Hyper Transfer Text'] },
      { question: 'Which array method creates a new array with elements that pass a test?', answer: 'filter', choices: ['map','filter','reduce','find'] },
      { question: 'In CSS, what property controls the text size?', answer: 'font-size', choices: ['font-weight','font-style','font-size','text-size'] },
      { question: 'What does SQL stand for?', answer: 'structured query language', choices: ['Structured Query Language','Simple Query Language','Sequence Query Language','Standard Query Language'] },
    ],
    math: [
      { question: 'What is the value of π (pi) to two decimal places?', answer: '3.14', choices: ['3.14','2.71','1.62','1.41'] },
      { question: 'Solve: 12 × 8 = ?', answer: '96', choices: ['96','108','84','92'] },
      { question: 'What is the square root of 144?', answer: '12', choices: ['14','12','10','16'] },
      { question: 'What is 15% of 200?', answer: '30', choices: ['25','30','35','40'] },
    ],
    science: [
      { question: 'What gas do plants absorb from the atmosphere?', answer: 'carbon dioxide', choices: ['Oxygen','Nitrogen','Carbon Dioxide','Hydrogen'] },
      { question: 'What is H2O commonly known as?', answer: 'water', choices: ['Salt','Hydrogen','Water','Oxygen'] },
      { question: 'What planet is known as the Red Planet?', answer: 'mars', choices: ['Mars','Venus','Jupiter','Mercury'] },
      { question: 'What force keeps us on the ground?', answer: 'gravity', choices: ['Magnetism','Friction','Gravity','Inertia'] },
    ],
    business: [
      { question: 'What does ROI stand for?', answer: 'return on investment', choices: ['Rate of Interest','Return on Investment','Revenue on Income','Run of Industry'] },
      { question: 'Which statement shows a company’s revenues and expenses?', answer: 'income statement', choices: ['Balance Sheet','Cash Flow','Income Statement','Equity Statement'] },
      { question: 'What does KPI stand for?', answer: 'key performance indicator', choices: ['Key Performance Indicator','Known Profit Index','Keen Performance Insight','Key Product Initiative'] },
      { question: 'Which is a fixed cost?', answer: 'rent', choices: ['Rent','Raw materials','Shipping','Packaging'] },
    ],
    general: [
      { question: 'Which continent is the Sahara Desert in?', answer: 'africa', choices: ['Africa','Asia','Australia','South America'] },
      { question: 'What is the capital of Japan?', answer: 'tokyo', choices: ['Kyoto','Osaka','Seoul','Tokyo'] },
      { question: 'How many days are there in a leap year?', answer: '366', choices: ['365','366','364','360'] },
      { question: 'Which language is primarily spoken in Brazil?', answer: 'portuguese', choices: ['Spanish','Portuguese','French','English'] },
    ],
  }
  const pool = pools[category] || pools.tech
  const d = new Date()
  const idx = (d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate()) % pool.length
  const item = pool[idx]
  if (item.choices) {
    const correct = item.choices.find(c => normalize(c) === normalize(item.answer))
    if (correct) return { ...item, answer: correct }
  }
  return item
}

function EmojiMemory() {
  const base = ['🍎','🍕','🎧','🚀','🐶','🌟']
  const [cards, setCards] = useState<Array<{ id:number; emoji:string; flipped:boolean; matched:boolean }>>([])
  const [flippedIds, setFlippedIds] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [won, setWon] = useState(false)

  useEffect(() => {
    const doubled = [...base, ...base].map((e, i) => ({ id:i, emoji:e, flipped:false, matched:false }))
    // Shuffle
    for (let i = doubled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[doubled[i], doubled[j]] = [doubled[j], doubled[i]]
    }
    setCards(doubled)
    setFlippedIds([])
    setMoves(0)
    setWon(false)
  }, [])

  const onFlip = (id: number) => {
    setCards(prev => prev.map(c => c.id === id && !c.matched && !c.flipped ? { ...c, flipped:true } : c))
    setFlippedIds(prev => {
      const next = [...prev, id].slice(-2)
      return next
    })
    setMoves(m => m + 1)
  }

  useEffect(() => {
    if (flippedIds.length === 2) {
      const [aId, bId] = flippedIds
      const a = cards.find(c => c.id === aId)
      const b = cards.find(c => c.id === bId)
      if (a && b) {
        if (a.emoji === b.emoji) {
          setCards(prev => prev.map(c => (c.id===aId||c.id===bId) ? { ...c, matched:true } : c))
          setTimeout(() => setCards(prev => prev.map(c => (c.id===aId||c.id===bId) ? { ...c, flipped:false } : c)), 300)
        } else {
          setTimeout(() => setCards(prev => prev.map(c => (c.id===aId||c.id===bId) ? { ...c, flipped:false } : c)), 600)
        }
        setTimeout(() => setFlippedIds([]), 620)
      }
    }
  }, [flippedIds])

  useEffect(() => {
    if (cards.length && cards.every(c => c.matched)) setWon(true)
  }, [cards])

  const reset = () => {
    // simple reload of component state
    const doubled = [...base, ...base].map((e, i) => ({ id:i, emoji:e, flipped:false, matched:false }))
    for (let i = doubled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[doubled[i], doubled[j]] = [doubled[j], doubled[i]]
    }
    setCards(doubled)
    setFlippedIds([])
    setMoves(0)
    setWon(false)
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Match the pairs</div>
        <div className="text-sm">Moves: <span className="font-medium">{moves}</span></div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => !card.flipped && !card.matched && flippedIds.length < 2 && onFlip(card.id)}
            className={`aspect-square rounded-lg flex items-center justify-center text-2xl sm:text-3xl border transition-colors ${card.matched ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700' : card.flipped ? 'bg-muted' : 'bg-background hover:bg-muted'}`}
          >
            {(card.flipped || card.matched) ? card.emoji : '❓'}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        {won ? <span className="text-sm text-green-600">You won! 🎉</span> : <span />}
        <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
      </div>
    </div>
  )
}
