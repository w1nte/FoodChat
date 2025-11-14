import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_KEY_STORAGE_KEY = 'foodchat_api_key'
const HISTORY_STORAGE_KEY = 'foodchat_history'
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini'
const SYSTEM_PROMPT = `Du bist FoodChat, ein Assistent für Foto- und Textbeschreibungen von Mahlzeiten.
Antworte ausschließlich als kompaktes JSON-Objekt ohne Erklärungstext oder Markdown.
Struktur:
{
  "type": "setting" | "nutrition" | "ask",
  "message": "<deine kurze Antwort auf Deutsch>",
  "calories": <Zahl>
}
- "setting": Verwende nur, wenn der aktuelle Nutzer seinen OpenAI Key bestätigt oder ein lokaler Wert aktualisiert werden soll. calories = 0.
- "nutrition": Schätze Kalorien anhand von Bild und/oder Text. "message" enthält eine kurze Beschreibung samt kcal. calories ist eine positive Ganzzahl.
- "ask": Nutze dies, wenn mehr Informationen zu Portion, Zutaten oder Zubereitung fehlen. calories = 0.
Nutze ausschließlich die bereitgestellten Informationen.`

const TIME_FORMATTER = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const LONG_DAY_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
})
const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })
const NUMBER_FORMATTER = new Intl.NumberFormat('de-DE')

const getTodayKey = () => new Date().toISOString().slice(0, 10)
const createEmptyDay = (date) => ({ date, messages: [] })
const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const sumCalories = (day) =>
  day.messages.reduce((total, message) => {
    if (
      message.kind === 'nutrition' &&
      typeof message.calories === 'number' &&
      !message.disabled
    ) {
      return total + message.calories
    }
    return total
  }, 0)

const formatDay = (dateId, formatter) => {
  if (!dateId) return ''
  const parsed = new Date(`${dateId}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateId
  return formatter.format(parsed)
}

const readStoredApiKey = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
}

const readStoredHistory = () => {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.entries(parsed).reduce((acc, [dayKey, dayValue]) => {
      const safeDay = Array.isArray(dayValue?.messages)
        ? { date: dayValue.date ?? dayKey, messages: dayValue.messages }
        : createEmptyDay(dayKey)
      acc[dayKey] = safeDay
      return acc
    }, {})
  } catch {
    return {}
  }
}

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const cleanModelText = (text = '') =>
  text
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim()

const parseAssistantPayload = (rawText) => {
  const fallback = {
    type: 'ask',
    message: 'Ich konnte die Antwort nicht lesen. Beschreibe dein Essen bitte noch einmal.',
    calories: 0,
  }
  if (!rawText) return fallback
  try {
    const parsed = JSON.parse(cleanModelText(rawText))
    const type = ['nutrition', 'ask', 'setting'].includes(parsed.type) ? parsed.type : 'ask'
    const message =
      typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : fallback.message
    const calories =
      type === 'nutrition' && Number.isFinite(Number(parsed.calories))
        ? Math.max(0, Math.round(Number(parsed.calories)))
        : 0
    return { type, message, calories }
  } catch {
    return fallback
  }
}

const extractAssistantContent = (message) => {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part?.type === 'text' && typeof part.text === 'string') return part.text
        if (typeof part?.text === 'string') return part.text
        return ''
      })
      .join('\n')
  }
  return ''
}

const buildUserContent = (text, image) => {
  const content = []
  if (text) {
    content.push({ type: 'text', text })
  }
  if (image?.preview) {
    content.push({
      type: 'image_url',
      image_url: { url: image.preview },
    })
  }
  return content
}

const convertMessageToModelTurn = (message) => {
  if (!message) return null
  if (message.role === 'user') {
    const parts = []
    if (message.text) parts.push(message.text)
    if (message.image) parts.push('[Foto der Mahlzeit gesendet]')
    if (!parts.length) return null
    return {
      role: 'user',
      content: [{ type: 'text', text: parts.join(' ') }],
    }
  }

  const meta = []
  if (message.kind) meta.push(`type=${message.kind}`)
  if (message.kind === 'nutrition' && typeof message.calories === 'number' && message.calories > 0) {
    meta.push(`calories=${message.calories}`)
  }
  const prefix = meta.length ? `[${meta.join(', ')}] ` : ''
  const text = [prefix, message.text ?? ''].join('').trim()
  if (!text) return null
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
  }
}

function App() {
  const todayKey = getTodayKey()
  const [apiKey, setApiKey] = useState(() => readStoredApiKey())
  const [history, setHistory] = useState(() => {
    const stored = readStoredHistory()
    if (!stored[todayKey]) {
      return { ...stored, [todayKey]: createEmptyDay(todayKey) }
    }
    return stored
  })
  const [activeDayId, setActiveDayId] = useState(todayKey)
  const [inputValue, setInputValue] = useState('')
  const [imageDraft, setImageDraft] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setHistory((prev) => {
      if (prev[todayKey]) return prev
      return { ...prev, [todayKey]: createEmptyDay(todayKey) }
    })
  }, [todayKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
  }, [apiKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const activeDay = history[activeDayId] ?? createEmptyDay(activeDayId)
  const todaysDay = history[todayKey] ?? createEmptyDay(todayKey)
  const todaysCalories = useMemo(() => sumCalories(todaysDay), [todaysDay])
  const activeDayLabel =
    activeDayId === todayKey ? 'Heute' : formatDay(activeDayId, LONG_DAY_FORMATTER)
  const historyItems = useMemo(() => {
    const entries = Object.keys(history)
    if (!entries.length) return []
    return entries
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => {
        const day = history[date] ?? createEmptyDay(date)
        return {
          ...day,
          calories: sumCalories(day),
        }
      })
  }, [history])

  const isViewingArchive = activeDayId !== todayKey
  const canSend = Boolean(inputValue.trim() || imageDraft)

  const appendMessage = (dayKey, message) => {
    setHistory((prev) => {
      const day = prev[dayKey] ?? createEmptyDay(dayKey)
      return {
        ...prev,
        [dayKey]: { ...day, messages: [...day.messages, message] },
      }
    })
  }

  const toggleNutritionEntry = (messageId, dayId = activeDayId) => {
    setHistory((prev) => {
      const day = prev[dayId]
      if (!day) return prev
      const updatedMessages = day.messages.map((message) => {
        if (message.id !== messageId || message.kind !== 'nutrition') return message
        return { ...message, disabled: !message.disabled }
      })
      return {
        ...prev,
        [dayId]: { ...day, messages: updatedMessages },
      }
    })
  }

  const handleSend = async (event) => {
    event.preventDefault()
    if (isSending || isViewingArchive) return

    const trimmed = inputValue.trim()
    if (!trimmed && !imageDraft) return

    const payloadImage = imageDraft

    setInputValue('')
    setImageDraft(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    setIsSending(true)

    try {
      if (!apiKey) {
        if (!trimmed) {
          appendMessage(todayKey, {
            id: createId(),
            role: 'assistant',
            text: 'Bitte gib zuerst deinen OpenAI API Key ein.',
            kind: 'setting',
            calories: 0,
            createdAt: new Date().toISOString(),
          })
          return
        }

        setApiKey(trimmed)
        appendMessage(todayKey, {
          id: createId(),
          role: 'assistant',
          text: 'Danke! Ich habe den API Key lokal gespeichert. Erzähle mir jetzt von deinem Essen.',
          kind: 'setting',
          calories: 0,
          createdAt: new Date().toISOString(),
        })
        return
      }

      const todaysMessages = history[todayKey]?.messages ?? []
      const historyTurns = todaysMessages.slice(-8).map(convertMessageToModelTurn).filter(Boolean)

      const userMessage = {
        id: createId(),
        role: 'user',
        text: trimmed,
        image: payloadImage?.preview ?? null,
        createdAt: new Date().toISOString(),
      }

      appendMessage(todayKey, userMessage)

      const preparedText = trimmed || (payloadImage ? 'Das folgende Foto zeigt meine Mahlzeit.' : '')
      const contentPayload = buildUserContent(preparedText, payloadImage)

      if (!contentPayload.length) {
        appendMessage(todayKey, {
          id: createId(),
          role: 'assistant',
          text: 'Beschreibe dein Essen oder lade ein Bild hoch, dann kann ich helfen.',
          kind: 'ask',
          calories: 0,
          createdAt: new Date().toISOString(),
        })
        return
      }

      const response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...historyTurns,
            {
              role: 'user',
              content: contentPayload,
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI Fehler (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      const assistantText = extractAssistantContent(result.choices?.[0]?.message)
      const structured = parseAssistantPayload(assistantText)

      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        text: structured.message,
        kind: structured.type,
        calories: structured.calories,
        createdAt: new Date().toISOString(),
      }
      if (structured.type === 'nutrition') {
        assistantMessage.disabled = false
      }

      appendMessage(todayKey, assistantMessage)
    } catch (error) {
      console.error('OpenAI request failed', error)
      appendMessage(todayKey, {
        id: createId(),
        role: 'assistant',
        text: 'Ich konnte keine Antwort von OpenAI erhalten. Bitte überprüfe deinen API Key oder versuche es erneut.',
        kind: 'ask',
        calories: 0,
        createdAt: new Date().toISOString(),
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const preview = await readFileAsDataUrl(file)
      setImageDraft({
        name: file.name,
        preview,
      })
    } catch {
      setImageDraft(null)
    }
  }

  const placeholder = !apiKey ? 'Your API Key' : 'Was hast du gegessen?'
  const composerDisabled = isSending || isViewingArchive

  return (
    <div className="app-wrapper">
      <div className="chat-shell">
        <header className="chat-header">
          <div className="header-bar">
            <button className="day-button" onClick={() => setShowHistory(true)}>
              Heute
            </button>
            <div className="header-summary">
              <span>Gesamt heute</span>
              <strong>{NUMBER_FORMATTER.format(todaysCalories)} kcal</strong>
            </div>
          </div>
          <p className="day-note">{activeDayLabel}</p>
        </header>

        <main className="chat-body">
          {activeDay.messages.length === 0 && (
            <div className="chat-empty">
              <p>Noch keine Einträge für diesen Tag.</p>
              <small>Tippe eine Mahlzeit ein oder lade ein Foto hoch.</small>
            </div>
          )}
          <ul className="message-list">
            {activeDay.messages.map((message) => {
              const bubbleClass = [
                'message',
                `message-${message.role}`,
                message.kind ? `message-${message.kind}` : '',
                message.disabled ? 'message-disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <li key={message.id} className={bubbleClass}>
                  <div className="bubble">
                    {message.image && (
                      <img src={message.image} alt="Benutzer Upload" className="bubble-image" />
                    )}
                    {message.text && <p>{message.text}</p>}
                    {message.kind === 'nutrition' && (
                      <div className="nutrition-meta">
                        <span
                          className={`calorie-pill ${message.disabled ? 'disabled' : ''}`}
                        >
                          +{NUMBER_FORMATTER.format(message.calories)} kcal
                        </span>
                        <button
                          type="button"
                          className="nutrition-toggle"
                          onClick={() => toggleNutritionEntry(message.id, activeDayId)}
                          aria-label={
                            message.disabled
                              ? 'Kalorieneintrag aktivieren'
                              : 'Kalorieneintrag deaktivieren'
                          }
                        >
                          <span className="icon-glyph" aria-hidden="true">
                            {message.disabled ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    )}
                    {message.kind === 'ask' && <span className="hint-pill">Nachfrage</span>}
                    {message.kind === 'setting' && <span className="hint-pill">Einstellung gespeichert</span>}
                  </div>
                  <time>{TIME_FORMATTER.format(new Date(message.createdAt))}</time>
                </li>
              )
            })}
          </ul>

          {!apiKey && (
            <div className="setup-hint">
              Willkommen, bevor du deine Kalorien tracken kannst, musst du ein paar Daten eingeben.
              Bitte schreibe mir als erstes deinen OpenAI API Key.
            </div>
          )}
        </main>

        {imageDraft && (
          <div className="image-preview">
            <img src={imageDraft.preview} alt="Ausgewählte Mahlzeit" />
            <div>
              <p>{imageDraft.name}</p>
              <button type="button" onClick={() => setImageDraft(null)}>
                Entfernen
              </button>
            </div>
          </div>
        )}

        {isViewingArchive && (
          <div className="archive-hint">
            Du schaust dir den Verlauf an. Neue Einträge können nur heute erstellt werden.
            <button type="button" onClick={() => setActiveDayId(todayKey)}>
              Zurück zu Heute
            </button>
          </div>
        )}

        <form className="composer" onSubmit={handleSend}>
          <label
            className={`icon-button ${!apiKey || composerDisabled ? 'disabled' : ''}`}
            aria-disabled={!apiKey || composerDisabled}
          >
            <span className="icon-glyph" aria-hidden="true">
              photo_camera
            </span>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              disabled={!apiKey || composerDisabled}
            />
          </label>
          <input
            className="composer-input"
            placeholder={placeholder}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            disabled={composerDisabled}
          />
          <button className="send-button" type="submit" disabled={composerDisabled || !canSend} aria-label="Nachricht senden">
            <span className="icon-glyph" aria-hidden="true">
              north
            </span>
          </button>
        </form>
      </div>

      {showHistory && (
        <div className="history-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-panel" onClick={(event) => event.stopPropagation()}>
            <div className="history-header">
              <h3>Chat-Verlauf</h3>
              <button type="button" onClick={() => setShowHistory(false)}>
                ×
              </button>
            </div>
            <ul className="history-list">
              {historyItems.map((day) => (
                <li key={day.date}>
                  <button
                    className={`history-item ${day.date === activeDayId ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setActiveDayId(day.date)
                      setShowHistory(false)
                    }}
                  >
                    <div>
                      <strong>
                        {day.date === todayKey ? 'Heute' : formatDay(day.date, SHORT_DAY_FORMATTER)}
                      </strong>
                      <span>{day.messages.length} Nachrichten</span>
                    </div>
                    <span className="history-calories">
                      {NUMBER_FORMATTER.format(day.calories)} kcal
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="history-settings">
              <label htmlFor="api-key-input">OpenAI API Key</label>
              <input
                id="api-key-input"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <button type="button" onClick={() => setApiKey('')}>
                API Key entfernen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
