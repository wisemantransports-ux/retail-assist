'use client';

import { useState } from 'react';

interface Message {
  id: string;
  sender: string;
  content: string;
  platform: 'facebook' | 'instagram';
  created_at: string;
  read: boolean;
}

export default function InboxPage() {
  const [messages] = useState<Message[]>([
    {
      id: '1',
      sender: 'John Doe',
      content: 'Hi, I saw your product on Facebook. Is it still available?',
      platform: 'facebook',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      read: false,
    },
    {
      id: '2',
      sender: 'Jane Smith',
      content: 'What are the shipping costs to Accra?',
      platform: 'facebook',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
    {
      id: '3',
      sender: 'Mike Johnson',
      content: 'Do you have this in blue color?',
      platform: 'instagram',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
  ]);

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredMessages = filter === 'unread' 
    ? messages.filter(m => !m.read) 
    : messages;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Inbox</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === 'unread' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      {filteredMessages.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <p className="text-gray-400">No messages yet.</p>
          <p className="text-gray-500 text-sm mt-2">
            Connect your Facebook page to start receiving messages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`bg-gray-800 border rounded-xl p-4 ${
                message.read ? 'border-gray-700' : 'border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                    message.platform === 'facebook' ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-600 to-pink-500'
                  }`}>
                    {message.platform === 'facebook' ? 'f' : '📷'}
                  </div>
                  <div>
                    <p className="text-white font-medium">{message.sender}</p>
                    <p className="text-gray-400 text-sm capitalize">{message.platform}</p>
                  </div>
                </div>
                <span className="text-gray-500 text-xs">
                  {new Date(message.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-300 mt-3">{message.content}</p>
              {!message.read && (
                <span className="inline-block mt-2 px-2 py-1 bg-blue-900/50 text-blue-400 text-xs rounded">
                  New
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
