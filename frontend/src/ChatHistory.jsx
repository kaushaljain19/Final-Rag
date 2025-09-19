import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Star,
  Calendar,
  MessageCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import axios from "axios";

function ChatHistory({ onBack }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // API Base URL configuration for production
  const API_BASE_URL = `${import.meta.env.VITE_API_URL}` || "";

  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = async () => {
    try {
      // Updated API call with base URL
      const response = await axios.get(`${API_BASE_URL}/api/chats`);
      if (response.data.success) {
        setChats(response.data.chats);
      } else {
        setError("Failed to load chat history");
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setError("Failed to load chat history. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ rating }) => {
    if (!rating)
      return <span className="text-xs text-gray-400">Not rated</span>;

    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
        <span className="text-xs text-gray-600 ml-1">({rating}/5)</span>
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderText = (rawText) => {
    const lines = rawText.split("\n").filter((line) => line.trim());

    return (
      <div className="space-y-1">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Main headings
          if (trimmed.startsWith("## ")) {
            return (
              <h3
                key={idx}
                className="font-semibold text-blue-700 text-sm mt-2 mb-1"
              >
                {trimmed.replace("## ", "")}
              </h3>
            );
          }

          // Bullet points
          if (trimmed.startsWith("• ")) {
            return (
              <div key={idx} className="flex items-start ml-2">
                <div className="w-1.5 h-1.5 bg-lime-500 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                <p className="text-xs text-gray-700 leading-relaxed flex-1">
                  {trimmed.slice(2)}
                </p>
              </div>
            );
          }

          // Regular paragraphs
          return (
            <p key={idx} className="text-xs text-gray-700 leading-relaxed">
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchChatHistory();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading chat history...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={handleRetry}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onBack}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm py-4">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back to Chat</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <MessageCircle className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    Chat History
                  </h1>
                  <p className="text-sm text-gray-600">
                    {chats.length} total conversations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat History List */}
      <div className="max-w-6xl mx-auto p-6">
        {chats.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              No Chat History
            </h2>
            <p className="text-gray-600 mb-4">
              Start a conversation to see your chat history here.
            </p>
            <button
              onClick={onBack}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Chatting
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {chats.map((chat) => (
              <div
                key={chat._id}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {chat.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            chat.success
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {chat.success ? "Success" : "Error"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">
                          {formatDate(chat.timestamp)}
                        </span>
                      </div>
                    </div>
                    <StarRating rating={chat.rating} />
                  </div>

                  {/* Question */}
                  <div className="mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="bg-blue-100 p-1.5 rounded-lg">
                        <MessageCircle className="w-3 h-3 text-blue-600" />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 uppercase">
                        Question
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium bg-blue-50 p-3 rounded-lg">
                      {chat.question}
                    </p>
                  </div>

                  {/* Answer */}
                  <div className="mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="bg-green-100 p-1.5 rounded-lg">
                        <MessageCircle className="w-3 h-3 text-green-600" />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 uppercase">
                        Answer
                      </span>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {renderText(chat.answer)}
                    </div>
                  </div>

                  {/* Page References */}
                  {chat.pageNumbers && chat.pageNumbers.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                        <p className="text-xs font-semibold text-blue-800">
                          📄 References: Page {chat.pageNumbers.join(", ")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Session Info */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Session: {chat.sessionId?.substring(0, 12)}...
                      </span>
                      <span>
                        Message ID: {chat.messageId?.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatHistory;
