/**
 * Mock OpenAI helpers used in dev / mock mode. Keep behavior deterministic and
 * simple — used only when `env.useMockMode` is true.
 */
import { env } from '../env'

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

const mockResponses: Record<string, string[]> = {
  greeting: [
    'Hello! How can I assist you today?',
    "Hi there — what can I help you with?",
    'Hey! Need a hand with something?'
  ],
  sales: [
    'Thanks for your interest — please visit our pricing page for more info!',
    'We offer flexible plans. Tell me more about your needs and I can help.',
    'I can help with that — would you like to upgrade to Pro for advanced features?'
  ],
  default: [
    "Thanks — I'll look into that and get back to you.",
    "Got it. We'll follow up shortly.",
    'Thanks for the message — we appreciate the feedback.'
  ]
}

export async function generateMockResponse(systemPrompt: string, userMessage: string): Promise<string> {
  // Simulate network/API delay
  await new Promise((r) => setTimeout(r, Math.random() * 300 + 200))

  const lm = userMessage.toLowerCase()
  if (lm.includes('hello') || lm.includes('hi')) return pick(mockResponses.greeting)
  if (lm.includes('price') || lm.includes('pricing') || lm.includes('plan')) return pick(mockResponses.sales)
  if (lm.includes('thank') || lm.includes('thanks')) return "You're welcome! Anything else I can help with?"

  // If env.useMockMode is false (shouldn't happen for mock imports), fall back to a neutral response
  if (!env.useMockMode) return mockResponses.default[0]

  return pick(mockResponses.default)
}
