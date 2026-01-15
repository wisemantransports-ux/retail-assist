'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Message, EmployeeMessageStatus, MessageChannel } from '@/lib/types/database'

export default function EmployeesDashboard() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: [] as EmployeeMessageStatus[],
    channel: [] as MessageChannel[],
    search: '',
    sortBy: 'created_at' as 'created_at' | 'updated_at',
    sortOrder: 'desc' as 'asc' | 'desc'
  })

  useEffect(() => {
    fetchMessages()
  }, [filters])

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams()
      filters.status.forEach(s => params.append('status', s))
      filters.channel.forEach(c => params.append('channel', c))
      if (filters.search) params.set('search', filters.search)
      params.set('sortBy', filters.sortBy)
      params.set('sortOrder', filters.sortOrder)

      const response = await fetch(`/api/messages?${params}`)
      const result = await response.json()
      if (result.data) {
        setMessages(result.data)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = (messageId: string, status: EmployeeMessageStatus) => {
    // Update local state
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, status } : msg
    ))
  }

  const handleRespond = async (messageId: string, response: string) => {
    try {
      const res = await fetch('/api/messages/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, response })
      })
      if (res.ok) {
        handleStatusChange(messageId, 'completed' as EmployeeMessageStatus)
      }
    } catch (error) {
      console.error('Error responding to message:', error)
    }
  }

  const handleEscalate = async (messageId: string) => {
    try {
      const res = await fetch('/api/messages/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, escalate: true })
      })
      if (res.ok) {
        handleStatusChange(messageId, 'escalated' as EmployeeMessageStatus)
      }
    } catch (error) {
      console.error('Error escalating message:', error)
    }
  }

  const getAISuggestion = async (messageId: string) => {
    try {
      const res = await fetch('/api/messages/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      })
      const result = await res.json()
      if (result.data) {
        // Update message with AI suggestion
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, ai_response: result.data.response } : msg
        ))
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Employees Dashboard</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            multiple
            value={filters.status}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value as EmployeeMessageStatus)
              setFilters(prev => ({ ...prev, status: values }))
            }}
            className="border rounded px-3 py-2"
          >
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="escalated">Escalated</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Channel</label>
          <select
            multiple
            value={filters.channel}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value as MessageChannel)
              setFilters(prev => ({ ...prev, channel: values }))
            }}
            className="border rounded px-3 py-2"
          >
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="website_chat">Website Chat</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder="Search messages..."
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="border rounded-lg p-4 bg-white shadow">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`px-2 py-1 rounded text-sm ${
                  message.status === 'new' ? 'bg-blue-100 text-blue-800' :
                  message.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  message.status === 'escalated' ? 'bg-red-100 text-red-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {message.status}
                </span>
                <span className="ml-2 text-sm text-gray-500">{message.channel}</span>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(message.created_at).toLocaleString()}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-gray-800">{message.content}</p>
            </div>

            {message.ai_response && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="text-sm font-medium text-gray-700">AI Suggestion:</p>
                <p className="text-gray-600">{message.ai_response}</p>
              </div>
            )}

            <div className="flex gap-2">
              {!message.ai_response && (
                <button
                  onClick={() => getAISuggestion(message.id)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Get AI Suggestion
                </button>
              )}

              {message.status !== 'completed' && message.status !== 'escalated' && (
                <>
                  <button
                    onClick={() => handleStatusChange(message.id, 'in_progress')}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Start Working
                  </button>

                  <button
                    onClick={() => {
                      const response = prompt('Enter your response:')
                      if (response) handleRespond(message.id, response)
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Respond
                  </button>

                  <button
                    onClick={() => handleEscalate(message.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Escalate
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}