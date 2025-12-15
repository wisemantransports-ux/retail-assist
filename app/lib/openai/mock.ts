/**
 * Mock OpenAI implementation for local development
 * Provides realistic responses without making actual API calls
 */

const mockResponses: Record<string, string[]> = {
  greeting: [
    'Hello! Thank you for reaching out. How can I help you today?',
    'Hi there! Welcome. What can I assist you with?',
    'Thanks for contacting us. How can we serve you?',
  ],
  sales: [
    'That\'s a great question! I\'d love to help you find the perfect product.',
    'I\'m glad you\'re interested. Let me tell you more about our offerings.',
    'Excellent choice! Here\'s what I can help you with.',
  ],
  support: [
    'I\'m here to help. Can you tell me more about the issue?',
    'Sorry to hear that. Let\'s work together to solve this.',
    'I understand your concern. Here\'s what we can do.',
  ],
  closing: [
    'Is there anything else I can help you with?',
    'Feel free to reach out anytime. We\'re here to help!',
    'Thanks for chatting with us!',
  ],
};

/**
 * Call mock OpenAI with realistic response
 */
export async function callOpenAI(input: string): Promise<string> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 300));

  // Determine response category based on input
  let category = 'greeting';

  if (
    input.toLowerCase().includes('hello') ||
    input.toLowerCase().includes('hi') ||
    input.toLowerCase().includes('hey')
  ) {
    category = 'greeting';
  } else if (
    input.toLowerCase().includes('problem') ||
    input.toLowerCase().includes('issue') ||
    input.toLowerCase().includes('help') ||
    input.toLowerCase().includes('error')
  ) {
    category = 'support';
  } else if (
    input.toLowerCase().includes('price') ||
    input.toLowerCase().includes('buy') ||
    input.toLowerCase().includes('product') ||
    input.toLowerCase().includes('order')
  ) {
    category = 'sales';
  } else if (
    input.toLowerCase().includes('bye') ||
    input.toLowerCase().includes('thanks') ||
    input.toLowerCase().includes('goodbye')
  ) {
    category = 'closing';
  }

  const responses = mockResponses[category];
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  return randomResponse;
}

/**
 * Generate mock chat response
 */
export async function generateMockResponse(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 300));

  // Simple rule-based responses
  if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
    return 'Hello! How can I assist you today?';
  }

  if (userMessage.toLowerCase().includes('thank')) {
    return 'You\'re welcome! Is there anything else I can help with?';
  }

  if (userMessage.toLowerCase().includes('?')) {
    return 'That\'s a great question. I\'d be happy to help. Can you provide more details?';
  }

  // Default response based on system prompt context
  if (systemPrompt.toLowerCase().includes('sales')) {
    return 'I\'d be happy to help you find what you\'re looking for. What interests you?';
  }

  if (systemPrompt.toLowerCase().includes('support')) {
    return 'I understand. Let me help you resolve this. Here are some options...';
  }

  return 'Thanks for that message. I\'m here to help if you need anything else.';
}
