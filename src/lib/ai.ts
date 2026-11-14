import type { AppSettings } from './types'

/**
 * AI client for any OpenAI-compatible endpoint (OpenAI, Gemini's OpenAI
 * compatibility layer, OpenRouter, Ollama, LM Studio…). Mirrors the Android
 * FioAiClient: same request shape, same calm error messages.
 */

export type AiResult = { ok: true; text: string } | { ok: false; error: string }

function friendlyError(status: number, raw: string): string {
  const rawLower = raw.toLowerCase()
  if (status === 401 || status === 403 || rawLower.includes('invalid api key') || rawLower.includes('unauthorized')) {
    return 'The AI key was rejected. Check your key in Settings → AI.'
  }
  if (status === 404 || rawLower.includes('model_not_found') || rawLower.includes('does not exist')) {
    return 'That model name is not available on your provider. Pick another model in Settings.'
  }
  if (status === 429 || rawLower.includes('rate limit') || rawLower.includes('overloaded')) {
    return 'Too much traffic on this AI model right now. Try another model in Settings, or come back in a minute.'
  }
  if (status >= 500) {
    return 'The AI provider is having trouble. Try again in a little while.'
  }
  return `The AI could not answer right now (HTTP ${status}).`
}

export async function sendPrompt(
  prompt: string,
  systemInstruction: string,
  settings: AppSettings,
  opts: { imageBase64?: string; tone?: string } = {}
): Promise<AiResult> {
  if (!settings.aiApiKey.trim()) {
    return { ok: false, error: 'API Key is missing. Please configure your key in Settings.' }
  }
  const base = settings.aiBaseUrl.trim().replace(/\/+$/, '') || 'https://api.openai.com/v1'
  const url = `${base}/chat/completions`
  const tone = opts.tone ?? 'Respond in clean markdown, concise and clear.'
  const system = `${systemInstruction}\n${tone}`

  const userContent: unknown = opts.imageBase64
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: opts.imageBase64 } }
      ]
    : prompt

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.aiApiKey.trim()}`,
        'Content-Type': 'application/json',
        ...(url.includes('openrouter')
          ? { 'HTTP-Referer': 'https://fio.local', 'X-Title': 'Fio Wingman AI' }
          : {})
      },
      body: JSON.stringify({
        model: settings.aiModelName.trim() || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ],
        temperature: 0.7
      })
    })
    const bodyText = await res.text()
    if (!res.ok) return { ok: false, error: friendlyError(res.status, bodyText) }
    const data = JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    if (!text) return { ok: false, error: 'Empty response from AI provider' }
    return { ok: true, text }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
      return { ok: false, error: 'No internet connection, or the provider blocks browser requests. Connect to Wi-Fi or data and try again.' }
    }
    return { ok: false, error: msg || 'Unknown error connecting to AI provider' }
  }
}
