import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_KEY_STORAGE_KEY = 'foodchat_api_key'
const HISTORY_STORAGE_KEY = 'foodchat_history'
const LOCALE_STORAGE_KEY = 'foodchat_locale'
const THEME_STORAGE_KEY = 'foodchat_theme'
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini'
const SUPPORTED_LOCALES = ['de', 'en']
const FALLBACK_LOCALE = 'de'
const THEMES = ['dark', 'light']
const DEFAULT_THEME = 'dark'
const LOCALE_TAG = {
  de: 'de-DE',
  en: 'en-US',
}

const SYSTEM_PROMPTS = {
  de: `Du bist FoodChat, ein Assistent für Foto- und Textbeschreibungen von Mahlzeiten.
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
Nutze ausschließlich die bereitgestellten Informationen.`,
  en: `You are FoodChat, a nutrition assistant for photo and text descriptions of meals.
Reply only with a compact JSON object—no explanations or Markdown.
Structure:
{
  "type": "setting" | "nutrition" | "ask",
  "message": "<your short answer in English>",
  "calories": <number>
}
- "setting": Use only to confirm the API key or change a local setting. calories = 0.
- "nutrition": Estimate calories based on the provided description or image. "message" should include a short description and kcal. calories is a positive integer.
- "ask": Use when you need more info about portion size, ingredients, or preparation. calories = 0.
Use only the supplied information.`,
}

const TRANSLATIONS = {
  de: {
    today: 'Heute',
    todayUpper: 'HEUTE',
    totalToday: 'Gesamt heute',
    emptyTitle: 'Noch keine Einträge für diesen Tag.',
    emptySubtitle: 'Tippe eine Mahlzeit ein oder lade ein Foto hoch.',
    setupIntro:
      'Willkommen, bevor du deine Kalorien tracken kannst, musst du ein paar Daten eingeben.',
    setupRequestKey: 'Bitte schreibe mir als erstes deinen OpenAI API Key.',
    placeholderApiKey: 'Dein API Key',
    placeholderMeal: 'Was hast du gegessen?',
    removeImage: 'Entfernen',
    introTitle: 'Dein smarter Ernährungs-Chat',
    introBody: 'FoodChat analysiert deine Mahlzeiten, schätzt Kalorien und hilft dir bei Fragen – einfach Foto oder Text senden.',
    archiveHint: 'Du schaust dir den Verlauf an. Neue Einträge können nur heute erstellt werden.',
    archiveBack: 'Zurück zu Heute',
    historyTitle: 'Chat-Verlauf',
    historyMessagesLabel: 'Nachrichten',
    hintAsk: 'Nachfrage',
    hintSetting: 'Einstellung gespeichert',
    photoPickerLabel: 'Foto hinzufügen',
    sendButtonLabel: 'Nachricht senden',
    needApiKey: 'Bitte gib zuerst deinen OpenAI API Key ein.',
    apiKeySaved: 'Danke! Ich habe den API Key lokal gespeichert. Erzähle mir jetzt von deinem Essen.',
    missingDescription: 'Beschreibe dein Essen oder lade ein Bild hoch, dann kann ich helfen.',
    requestFailed:
      'Ich konnte keine Antwort von OpenAI erhalten. Bitte überprüfe deinen API Key oder versuche es erneut.',
    fallbackUnreadable:
      'Ich konnte die Antwort nicht lesen. Beschreibe dein Essen bitte noch einmal.',
    photoFallback: 'Das folgende Foto zeigt meine Mahlzeit.',
    localeToggleLabel: 'Sprache wechseln',
    messageLabelActivate: 'Kalorieneintrag aktivieren',
    messageLabelDeactivate: 'Kalorieneintrag deaktivieren',
    settingsButtonLabel: 'Einstellungen öffnen',
    settingsTitle: 'Einstellungen',
    settingsApiLabel: 'OpenAI API Key',
    settingsApiClear: 'API Key entfernen',
    settingsLanguageLabel: 'Sprache',
    settingsThemeLabel: 'Theme',
    settingsThemeLight: 'Hell',
    settingsThemeDark: 'Dunkel',
    settingsClose: 'Schließen',
  },
  en: {
    today: 'Today',
    todayUpper: 'TODAY',
    totalToday: 'Total today',
    emptyTitle: 'No entries for this day yet.',
    emptySubtitle: 'Type a meal or upload a photo to get started.',
    setupIntro: 'Welcome! Before you can track calories, I need a bit of information.',
    setupRequestKey: 'Please start by sending me your OpenAI API key.',
    placeholderApiKey: 'Your API Key',
    placeholderMeal: 'What did you eat?',
    removeImage: 'Remove',
    introTitle: 'Your smart nutrition chat',
    introBody: 'FoodChat analyzes your meals, estimates calories, and asks for details when needed—just send text or a photo.',
    archiveHint: 'You are viewing history. New entries can only be added today.',
    archiveBack: 'Back to Today',
    historyTitle: 'Chat history',
    historyMessagesLabel: 'messages',
    hintAsk: 'Follow-up',
    hintSetting: 'Setting saved',
    photoPickerLabel: 'Add photo',
    sendButtonLabel: 'Send message',
    needApiKey: 'Please send your OpenAI API key first.',
    apiKeySaved: 'Thanks! I stored the API key locally. Tell me about your meal now.',
    missingDescription: 'Describe your food or upload a picture so I can help.',
    requestFailed: 'I could not get a response from OpenAI. Check your API key or try again.',
    fallbackUnreadable: 'I could not read the answer. Please describe your meal again.',
    photoFallback: 'The following photo shows my meal.',
    localeToggleLabel: 'Toggle language',
    messageLabelActivate: 'Enable calorie entry',
    messageLabelDeactivate: 'Disable calorie entry',
    settingsButtonLabel: 'Open settings',
    settingsTitle: 'Settings',
    settingsApiLabel: 'OpenAI API Key',
    settingsApiClear: 'Remove API Key',
    settingsLanguageLabel: 'Language',
    settingsThemeLabel: 'Theme',
    settingsThemeLight: 'Light',
    settingsThemeDark: 'Dark',
    settingsClose: 'Close',
  },
}

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

const createFormatters = (locale) => {
  const tag = LOCALE_TAG[locale] ?? LOCALE_TAG[FALLBACK_LOCALE]
  return {
    timeFormatter: new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' }),
    longDayFormatter: new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    }),
    shortDayFormatter: new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit' }),
    numberFormatter: new Intl.NumberFormat(tag),
  }
}

const readStoredApiKey = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
}

const readStoredLocale = () => {
  if (typeof window === 'undefined') return FALLBACK_LOCALE
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return SUPPORTED_LOCALES.includes(stored) ? stored : FALLBACK_LOCALE
}

const readStoredTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return THEMES.includes(stored) ? stored : DEFAULT_THEME
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

const parseAssistantPayload = (rawText, fallbackMessage) => {
  const fallback = {
    type: 'ask',
    message: fallbackMessage,
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

const getSystemPrompt = (locale) => SYSTEM_PROMPTS[locale] ?? SYSTEM_PROMPTS[FALLBACK_LOCALE]

function App() {
  const todayKey = getTodayKey()
  const [locale, setLocale] = useState(() => readStoredLocale())
  const [theme, setTheme] = useState(() => readStoredTheme())
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
  const [showSettings, setShowSettings] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const fileInputRef = useRef(null)
  const chatBodyRef = useRef(null)
  const t = (key) => TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS[FALLBACK_LOCALE][key] ?? key

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
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const activeDay = history[activeDayId] ?? createEmptyDay(activeDayId)

  useEffect(() => {
    const container = chatBodyRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [activeDayId])

  const { timeFormatter, longDayFormatter, shortDayFormatter, numberFormatter } = useMemo(
    () => createFormatters(locale),
    [locale],
  )

  const todaysDay = history[todayKey] ?? createEmptyDay(todayKey)
  const todaysCalories = useMemo(() => sumCalories(todaysDay), [todaysDay])
  const activeDayLabel =
    activeDayId === todayKey ? t('todayUpper') : formatDay(activeDayId, longDayFormatter)
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
  const selectLocale = (nextLocale) => {
    if (SUPPORTED_LOCALES.includes(nextLocale)) {
      setLocale(nextLocale)
    }
  }
  const selectTheme = (nextTheme) => {
    if (THEMES.includes(nextTheme)) {
      setTheme(nextTheme)
    }
  }

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

    setIsSending(true)

    try {
      if (!apiKey) {
        if (!trimmed) {
          appendMessage(todayKey, {
            id: createId(),
            role: 'assistant',
            text: t('needApiKey'),
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
          text: t('apiKeySaved'),
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
      requestAnimationFrame(() => {
        const container = chatBodyRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })

      const preparedText = trimmed || (payloadImage ? t('photoFallback') : '')
      const contentPayload = buildUserContent(preparedText, payloadImage)

      if (!contentPayload.length) {
        appendMessage(todayKey, {
          id: createId(),
          role: 'assistant',
          text: t('missingDescription'),
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
            { role: 'system', content: getSystemPrompt(locale) },
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
      const structured = parseAssistantPayload(assistantText, t('fallbackUnreadable'))

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
      requestAnimationFrame(() => {
        const container = chatBodyRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    } catch (error) {
      console.error('OpenAI request failed', error)
      appendMessage(todayKey, {
        id: createId(),
        role: 'assistant',
        text: t('requestFailed'),
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

  const placeholder = !apiKey ? t('placeholderApiKey') : t('placeholderMeal')
  const composerDisabled = isSending || isViewingArchive

  return (
    <div className="app-wrapper">
      <div className="chat-shell">
        <header className="chat-header">
          <div className="header-bar">
            <div className="header-actions">
              <button className="day-button" onClick={() => setShowHistory(true)}>
                {t('today')}
              </button>
              <button
                type="button"
                className="settings-button"
                onClick={() => setShowSettings(true)}
                aria-label={t('settingsButtonLabel')}
                title={t('settingsButtonLabel')}
              >
                <span className="icon-glyph" aria-hidden="true">
                  settings
                </span>
              </button>
            </div>
            <div className="header-summary">
              <span>{t('totalToday')}</span>
              <strong>
                {numberFormatter.format(todaysCalories)} kcal
              </strong>
            </div>
          </div>
          <p className="day-note">{activeDayLabel}</p>
        </header>

        <main className="chat-body" ref={chatBodyRef}>
          {!apiKey && (
            <div className="intro-card">
              <h3>{t('introTitle')}</h3>
              <p>{t('introBody')}</p>
            </div>
          )}
          {activeDay.messages.length === 0 && (
            <div className="chat-empty">
              <p>{t('emptyTitle')}</p>
              <small>{t('emptySubtitle')}</small>
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
                          +{numberFormatter.format(message.calories)} kcal
                        </span>
                        <button
                          type="button"
                          className="nutrition-toggle"
                          onClick={() => toggleNutritionEntry(message.id, activeDayId)}
                          aria-label={
                            message.disabled
                              ? t('messageLabelActivate')
                              : t('messageLabelDeactivate')
                          }
                        >
                          <span className="icon-glyph" aria-hidden="true">
                            {message.disabled ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    )}
                    {message.kind === 'ask' && <span className="hint-pill">{t('hintAsk')}</span>}
                    {message.kind === 'setting' && (
                      <span className="hint-pill">{t('hintSetting')}</span>
                    )}
                  </div>
                  <time>{timeFormatter.format(new Date(message.createdAt))}</time>
                </li>
              )
            })}
          </ul>

          {!apiKey && (
            <div className="setup-hint">
              <p>{t('setupIntro')}</p>
              <p>{t('setupRequestKey')}</p>
            </div>
          )}
        </main>

        {imageDraft && (
          <div className="image-preview">
            <img src={imageDraft.preview} alt="Ausgewählte Mahlzeit" />
            <div>
              <p>{imageDraft.name}</p>
              <button type="button" onClick={() => setImageDraft(null)}>
                {t('removeImage')}
              </button>
            </div>
          </div>
        )}

        {isViewingArchive && (
          <div className="archive-hint">
            {t('archiveHint')}
            <button type="button" onClick={() => setActiveDayId(todayKey)}>
              {t('archiveBack')}
            </button>
          </div>
        )}

        <form className="composer" onSubmit={handleSend}>
          <label
            className={`icon-button ${!apiKey || composerDisabled ? 'disabled' : ''}`}
            aria-disabled={!apiKey || composerDisabled}
            aria-label={t('photoPickerLabel')}
            title={t('photoPickerLabel')}
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
          <button
            className="send-button"
            type="submit"
            disabled={composerDisabled || !canSend}
            aria-label={t('sendButtonLabel')}
            title={t('sendButtonLabel')}
          >
            <span className="icon-glyph" aria-hidden="true">
              north
            </span>
          </button>
        </form>
      </div>

      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-panel history-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('historyTitle')}</h3>
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
                        {day.date === todayKey ? t('today') : formatDay(day.date, shortDayFormatter)}
                      </strong>
                      <span>
                        {day.messages.length} {t('historyMessagesLabel')}
                      </span>
                    </div>
                    <span className="history-calories">
                      {numberFormatter.format(day.calories)} kcal
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-panel settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('settingsTitle')}</h3>
              <button type="button" onClick={() => setShowSettings(false)}>
                ×
              </button>
            </div>

            <div className="settings-section">
              <label htmlFor="settings-api-key">{t('settingsApiLabel')}</label>
              <input
                id="settings-api-key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <button type="button" onClick={() => setApiKey('')}>
                {t('settingsApiClear')}
              </button>
            </div>

            <div className="settings-section">
              <span>{t('settingsLanguageLabel')}</span>
              <div className="option-group">
                {SUPPORTED_LOCALES.map((lng) => (
                  <button
                    key={lng}
                    type="button"
                    className={`option-button ${locale === lng ? 'active' : ''}`}
                    onClick={() => selectLocale(lng)}
                    aria-pressed={locale === lng}
                  >
                    {lng.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <span>{t('settingsThemeLabel')}</span>
              <div className="option-group">
                <button
                  type="button"
                  className={`option-button ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => selectTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  {t('settingsThemeDark')}
                </button>
                <button
                  type="button"
                  className={`option-button ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => selectTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  {t('settingsThemeLight')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
