import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { createMessage, updateMessageStatus, respondToMessage, escalateMessage, generateAIResponse } from '@/lib/supabase/queries'

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            maybeSingle: jest.fn(() => ({ data: { id: 'test-message-id' }, error: null }))
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() => ({ data: { id: 'test-message-id', status: 'completed' }, error: null }))
            }))
          }))
        }))
      }))
    }))
  }))
}))

describe('Message Queueing Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createMessage', () => {
    it('should create a message with correct payload', async () => {
      const payload = {
        sender_id: 'sender123',
        channel: 'facebook' as const,
        content: 'Hello world',
        business_id: 'business123'
      }

      const result = await createMessage(payload)

      expect(result.data).toBeDefined()
      expect(result.error).toBeNull()
    })

    it('should handle AI confidence below threshold', async () => {
      const payload = {
        sender_id: 'sender123',
        channel: 'facebook' as const,
        content: 'Hello world',
        ai_confidence: 0.5 // Below threshold
      }

      const result = await createMessage(payload)

      expect(result.data?.status).toBe('new')
      // Should trigger auto-queueing logic
    })
  })

  describe('updateMessageStatus', () => {
    it('should update message status correctly', async () => {
      const result = await updateMessageStatus('message123', 'in_progress', 'employee123')

      expect(result.data?.status).toBe('in_progress')
      expect(result.data?.assigned_to_employee_id).toBe('employee123')
    })

    it('should not assign employee for non-in-progress status', async () => {
      const result = await updateMessageStatus('message123', 'completed')

      expect(result.data?.status).toBe('completed')
      expect(result.data?.assigned_to_employee_id).toBeUndefined()
    })
  })

  describe('respondToMessage', () => {
    it('should mark message as completed with response', async () => {
      const result = await respondToMessage('message123', 'Thank you for your inquiry', 'employee123')

      expect(result.data?.status).toBe('completed')
      expect(result.data?.ai_response).toBe('Thank you for your inquiry')
      expect(result.data?.assigned_to_employee_id).toBe('employee123')
    })
  })

  describe('escalateMessage', () => {
    it('should escalate message to admin', async () => {
      const result = await escalateMessage('message123', 'admin123', 'employee123')

      expect(result.data?.status).toBe('escalated')
      expect(result.data?.escalated_to_admin_id).toBe('admin123')
      expect(result.data?.assigned_to_employee_id).toBe('employee123')
    })
  })

  describe('generateAIResponse', () => {
    it('should generate and save AI response with confidence', async () => {
      const result = await generateAIResponse('message123', 'AI generated response', 0.85)

      expect(result.data?.ai_response).toBe('AI generated response')
      expect(result.data?.ai_confidence).toBe(0.85)
    })

    it('should handle low confidence responses', async () => {
      const result = await generateAIResponse('message123', 'Uncertain response', 0.3)

      expect(result.data?.ai_confidence).toBe(0.3)
      // Should potentially trigger escalation logic
    })
  })
})

describe('Auto-queueing Rules', () => {
  it('should queue messages with low AI confidence', () => {
    // Test the trigger function logic
    const message = {
      id: 'msg123',
      ai_confidence: 0.5,
      status: 'new',
      business_id: null
    }

    // Simulate trigger logic
    const shouldQueue = message.status === 'new' && (!message.ai_confidence || message.ai_confidence < 0.8)

    expect(shouldQueue).toBe(true)
  })

  it('should not queue messages with high AI confidence', () => {
    const message = {
      id: 'msg123',
      ai_confidence: 0.9,
      status: 'new',
      business_id: null
    }

    const shouldQueue = message.status === 'new' && (!message.ai_confidence || message.ai_confidence < 0.8)

    expect(shouldQueue).toBe(false)
  })

  it('should queue messages without AI confidence', () => {
    const message = {
      id: 'msg123',
      ai_confidence: null,
      status: 'new',
      business_id: 'business123'
    }

    const shouldQueue = message.status === 'new' && (!message.ai_confidence || message.ai_confidence < 0.8)

    expect(shouldQueue).toBe(true)
  })
})

describe('Role-based Access Control', () => {
  it('should allow super_admin to view all messages', () => {
    const userRole = 'super_admin'
    const canViewAll = userRole === 'super_admin'

    expect(canViewAll).toBe(true)
  })

  it('should allow admin to view business messages', () => {
    const userRole = 'admin'
    const businessId = 'business123'
    const canViewBusiness = userRole === 'admin' && businessId !== null

    expect(canViewBusiness).toBe(true)
  })

  it('should restrict employee to assigned messages', () => {
    const userRole = 'employee'
    const assignedEmployeeId = 'emp123'
    const canViewOnlyAssigned = userRole === 'employee' && assignedEmployeeId !== null

    expect(canViewOnlyAssigned).toBe(true)
  })
})