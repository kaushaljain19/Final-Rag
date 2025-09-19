import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, Star, History } from 'lucide-react';
import axios from 'axios';
import ChatHistory from './ChatHistory';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false); // New state for history view
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // API Base URL configuration for production
  const API_BASE_URL = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // If showing history, render ChatHistory component
  if (showHistory) {
    return <ChatHistory onBack={() => setShowHistory(false)} />;
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Updated API call with base URL
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        message: input.trim(),
        sessionId
      });

      if (response.data.success) {
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: response.data.answer,
          pageNumbers: response.data.pageNumbers || [],
          messageId: response.data.messageId,
          consistent: response.data.consistent || false,
          rating: null
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('API Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        content: "## Error\n\nSorry, something went wrong. Please try again.",
        pageNumbers: []
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const submitRating = async (messageId, rating) => {
    try {
      // Updated API call with base URL
      await axios.post(`${API_BASE_URL}/api/feedback`, { 
        messageId, 
        rating,
        sessionId 
      });
      setMessages(prev => prev.map(msg =>
        msg.messageId === messageId ? { ...msg, rating } : msg
      ));
    } catch (error) {
      console.error('Rating error:', error);
    }
  };

  const renderText = (rawText) => {
    let processedText = rawText;
    
    // Force structure if missing
    if (!processedText.includes('\n')) {
      processedText = processedText.replace(/([.!?])\s*(##)/g, '$1\n\n$2');
      processedText = processedText.replace(/(##[^•\n]+?)\s*(•|[A-Z])/g, '$1\n\n$2');
      processedText = processedText.replace(/(•[^•##]*?)\s*(•)/g, '$1\n$2');
      processedText = processedText.replace(/(•[^•##]*?)\s*(##)/g, '$1\n\n$2');
    }

    const lines = processedText.split('\n').filter(line => line.trim());
    
    return (
      <div className="space-y-0">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Main headings
          if (trimmed.startsWith('## ')) {
            return (
              <div key={idx} className="mt-6 mb-4 first:mt-2">
                <h2 className="text-lg font-bold text-blue-700 border-b-2 border-blue-200 pb-2">
                  {trimmed.replace('## ', '')}
                </h2>
              </div>
            );
          }

          // Bullet points
          if (trimmed.startsWith('• ')) {
            return (
              <div key={idx} className="flex items-start py-1.5 ml-2">
                <div className="w-2 h-2 bg-lime-500 rounded-full mt-2.5 mr-4 flex-shrink-0"></div>
                <div className="text-gray-800 text-sm leading-6 flex-1">
                  {formatInline(trimmed.slice(2))}
                </div>
              </div>
            );
          }

          // Regular paragraphs
          return (
            <div key={idx} className="py-2">
              <p className="text-gray-800 text-sm leading-6">
                {formatInline(trimmed)}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const formatInline = (text) => {
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span key={i} className="font-bold text-gray-900 bg-yellow-100 px-1.5 py-0.5 rounded">
            {part.slice(2, -2)}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const StarRating = ({ rating, onRate, readonly = false }) => {
    const [hover, setHover] = useState(0);
    
    return (
      <div className="flex space-x-1">
        {[1,2,3,4,5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 cursor-pointer transition-colors ${
              star <= (hover || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => !readonly && onRate?.(star)}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm py-5">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Left side - Logo and title */}
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2.5 rounded-xl">
                <Bot className="w-7 h-7 text-blue-600" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-gray-900">
                  Hospital Guidelines Assistant
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Ask about JCI standards, procedures, and safety protocols
                </p>
              </div>
            </div>
            
            {/* Right side - Show All Chats button */}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
            >
              <History className="w-4 h-4" />
              <span>Show All Chats</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Container - Exactly same as before */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg border h-[650px] flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 chat-scroll bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center py-20">
                <Bot className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                <h2 className="text-lg font-bold text-gray-800 mb-3">
                  Welcome! Ask me about hospital guidelines
                </h2>
                <div className="bg-white rounded-xl p-6 max-w-md mx-auto shadow-sm">
                  <p className="font-semibold text-gray-700 mb-4 text-sm">Example questions:</p>
                  <div className="space-y-2 text-left">
                    <div className="flex items-start">
                      <span className="text-blue-500 mr-2 mt-1">•</span>
                      <span className="text-gray-700 text-sm">"What is JCI?"</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-blue-500 mr-2 mt-1">•</span>
                      <span className="text-gray-700 text-sm">"What are infection control procedures?"</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-blue-500 mr-2 mt-1">•</span>
                      <span className="text-gray-700 text-sm">"How do we handle emergencies?"</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-6 py-4 message-enter ${
                    msg.type === 'user'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white border shadow-sm'
                  }`}>
                    {/* Header */}
                    <div className="flex items-center space-x-2 mb-3">
                      {msg.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-blue-600" />}
                      <span className="text-xs font-bold uppercase">
                        {msg.type === 'user' ? 'You' : 'Assistant'}
                      </span>
                      {msg.consistent && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Consistent
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div>
                      {msg.type === 'user' ? (
                        <p className="text-white leading-relaxed">{msg.content}</p>
                      ) : (
                        renderText(msg.content)
                      )}
                    </div>

                    {/* Page References - Commented out as in original
                    {msg.pageNumbers?.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                          <p className="text-xs font-semibold text-blue-800">
                            📄 References: Page {msg.pageNumbers.join(', ')}
                          </p>
                        </div>
                      </div>
                    )} */}

                    {/* Rating */}
                    {msg.type === 'bot' && msg.messageId && (
                      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center space-x-3">
                        <span className="text-xs text-gray-600 font-medium">Rate response:</span>
                        {msg.rating ? (
                          <div className="flex items-center space-x-2">
                            <StarRating rating={msg.rating} readonly />
                            <span className="text-xs text-gray-600">Thanks!</span>
                          </div>
                        ) : (
                          <StarRating onRate={r => submitRating(msg.messageId, r)} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border rounded-2xl px-6 py-4 flex items-center space-x-3 shadow-sm">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <Loader className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-600">Searching guidelines...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area - Exactly same as before */}
          <div className="border-t p-6 bg-white">
            <div className="flex space-x-4">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about hospital guidelines, JCI standards, procedures..."
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                disabled={loading}
                maxLength={500}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl px-6 py-3 font-medium transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            {input.length > 0 && (
              <p className="text-xs text-gray-500 mt-2 text-right">
                {input.length}/500 characters
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
