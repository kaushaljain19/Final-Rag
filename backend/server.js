const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Error:', err));

// Updated Schemas
const ChatSchema = new mongoose.Schema({
  sessionId: String,
  messageId: String,
  question: String,
  answer: String,
  pageNumbers: [Number],
  rating: { type: Number, default: null },
  success: { type: Boolean, default: true }, // New field to track successful responses
  timestamp: { type: Date, default: Date.now }
});

const ProcessedPDFSchema = new mongoose.Schema({
  filename: String,
  fileSize: Number,
  processedAt: { type: Date, default: Date.now },
  chunksCount: Number
});

const Chat = mongoose.model('Chat', ChatSchema);
const ProcessedPDF = mongoose.model('ProcessedPDF', ProcessedPDFSchema);

// Import RAG functions (instead of class)
const { initializeRAG, getAnswer } = require('./rag-service');

// Initialize RAG on startup
initializeRAG();

// API Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId required'
      });
    }

    const result = await getAnswer(message, sessionId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate response'
    });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { messageId, rating } = req.body;
    
    if (!messageId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'MessageId and rating required'
      });
    }

    await Chat.findOneAndUpdate({ messageId }, { rating });
    res.json({ success: true });
  } catch (error) {
    console.error('Feedback API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save rating'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Hospital RAG Chatbot API Running',
    timestamp: new Date().toISOString()
  });
});

// NEW API Route for Chat History
app.get('/api/chats', async (req, res) => {
  try {
    const allChats = await Chat.find({})
      .sort({ timestamp: -1 })
      .select('sessionId messageId question answer pageNumbers rating success timestamp');
    
    res.json({
      success: true,
      chats: allChats,
      total: allChats.length
    });
  } catch (error) {
    console.error('Chat History API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});