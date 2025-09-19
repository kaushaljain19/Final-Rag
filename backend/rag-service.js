const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { PineconeStore } = require('@langchain/pinecone');
const { Pinecone } = require('@pinecone-database/pinecone');
const { Document } = require('langchain/document');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// Global variables for shared resources
let llm;
let embeddings;
let pinecone;
let pineconeIndex;
let vectorStore;
let textSplitter;
let promptTemplate;

// Initialize LLM and other services
function initializeLLM() {
  llm = new ChatGoogleGenerativeAI({
    model: 'gemini-1.5-flash',
    temperature: 0.0,
    apiKey: process.env.GOOGLE_API_KEY,
    maxOutputTokens: 1200,
  });

  embeddings = new GoogleGenerativeAIEmbeddings({
    model: 'text-embedding-004',
    apiKey: process.env.GOOGLE_API_KEY,
  });

  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  
  pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ' ']
  });

   promptTemplate = PromptTemplate.fromTemplate(`
You are a specialized JCI Hospital Guidelines Assistant. Your role is strictly limited to providing information from uploaded hospital PDF documents.

Context from PDFs: {context}
Previous conversation: {history}
Question: {question}

CRITICAL INSTRUCTIONS:
1. ONLY answer questions related to hospital procedures, JCI guidelines, medical policies, and healthcare protocols that are present in the provided context.
2. If the question is NOT related to hospital/medical topics OR if no relevant context is provided, respond with the "OUT_OF_SCOPE" format below.
3. Base your answers STRICTLY on the provided PDF context - do not add external knowledge.
4. If context is provided but insufficient, ask for clarification rather than guessing.

OUT_OF_SCOPE Response Format:
## Outside My Expertise

I can only provide information from the hospital's JCI guidelines and medical procedures documentation.

## I Can Help With
• Hospital policies and procedures
• JCI accreditation standards  
• Medical protocols and guidelines
• Emergency procedures
• Patient care standards

## Please Ask About
Topics related to healthcare, hospital operations, or medical guidelines from our documentation.

ANSWER Response Format (only when context is relevant):
1. Brief intro paragraph
2. Add double newlines before ## headings
3. Add double newlines after ## headings
4. Add single newline after • bullet points
5. Use **text** for critical terms only
6. Cite only information from the provided context

Your response:

`);

//   promptTemplate = PromptTemplate.fromTemplate(`
// Context: {context}
// Previous conversation: {history}
// Question: {question}

// Format your answer with exact structure:
// 1. Brief intro paragraph
// 2. Add double newlines before ## headings
// 3. Add double newlines after ## headings
// 4. Add single newline after • bullet points
// 5. Use **text** for critical terms only

// Your formatted response:
// `);
}

// Initialize RAG system
async function initializeRAG() {
  try {
    console.log('Initializing RAG Service...');
    initializeLLM();
    await processPDFs();
    await initializeVectorStore();
    console.log('RAG Service initialized');
  } catch (error) {
    console.error('RAG Service initialization error:', error);
  }
}

// Process PDF files
async function processPDFs() {
  const pdfDir = path.join(__dirname, 'pdfs');
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir);
    console.log(`Created pdfs folder: ${pdfDir}`);
    return;
  }

  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  if (files.length === 0) {
    console.log('No PDF files found. Add your JCI PDF file to start.');
    return;
  }

  for (const filename of files) {
    await processIfNew(filename, pdfDir);
  }
}

// Process individual PDF if new
async function processIfNew(filename, pdfDir) {
  const filePath = path.join(pdfDir, filename);
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    let existing = null;
    try {
      const ProcessedPDF = mongoose.model('ProcessedPDF');
      existing = await ProcessedPDF.findOne({ filename, fileSize });
    } catch (error) {
      // Model not ready, will process
    }

    if (existing) {
      console.log(`${filename} already processed - Skipping`);
      return;
    }

    console.log(`Processing: ${filename}...`);
    
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(pdfBuffer);
    
    const docs = await textSplitter.createDocuments([pdfData.text]);
    
    const langchainDocs = docs.map((doc, index) => {
      const estimatedPage = Math.floor((index * 1000) / (pdfData.text.length / pdfData.numpages)) + 1;
      return new Document({
        pageContent: doc.pageContent,
        metadata: {
          source: filename,
          chunkIndex: index,
          pageNumber: Math.min(estimatedPage, pdfData.numpages),
          fileSize: fileSize
        }
      });
    });

    vectorStore = await PineconeStore.fromDocuments(
      langchainDocs,
      embeddings,
      { pineconeIndex: pineconeIndex }
    );

    try {
      const ProcessedPDF = mongoose.model('ProcessedPDF');
      const processedRecord = new ProcessedPDF({
        filename,
        fileSize,
        chunksCount: langchainDocs.length
      });
      await processedRecord.save();
    } catch (error) {
      // Could not save record, continue
    }

    console.log(`${filename} processed: ${langchainDocs.length} chunks stored`);
  } catch (error) {
    console.error(`Error processing ${filename}:`, error.message);
  }
}

// Initialize vector store connection
async function initializeVectorStore() {
  if (!vectorStore) {
    try {
      vectorStore = await PineconeStore.fromExistingIndex(
        embeddings,
        { pineconeIndex: pineconeIndex }
      );
      console.log('Vector store connected');
    } catch (error) {
      console.log('No existing vectors found. Upload PDFs first.');
    }
  }
}

// Format AI response text
function formatResponse(rawResponse) {
  let formatted = rawResponse;
  
  // Fix spacing around headings and bullets
  formatted = formatted.replace(/([.!?])\s*(##)/g, '$1\n\n$2');
  formatted = formatted.replace(/(##[^•\n]+?)(?=\s*•)/g, '$1\n\n');
  formatted = formatted.replace(/(•[^•##\n]*?)(?=\s*•)/g, '$1\n');
  formatted = formatted.replace(/(•[^•##\n]*?)(?=\s*##)/g, '$1\n\n');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.replace(/^\n+|\n+$/g, '');

  return formatted;
}

// Check if response is an error response
function isErrorResponse(answer) {
  const errorPatterns = [
    '## System Error',
    '## Error',
    'encountered an error',
    'something went wrong',
    'System is initializing',
    'Information Not Available'
  ];
  
  return errorPatterns.some(pattern => 
    answer.toLowerCase().includes(pattern.toLowerCase())
  );
}

// Main function to get answer
async function getAnswer(question, sessionId) {
  const messageId = uuidv4();
  try {
    let Chat = null;
    try {
      Chat = mongoose.model('Chat');
    } catch (error) {
      return {
        messageId,
        answer: "## System Error\n\nSystem is initializing. Please wait a moment and try again.",
        pageNumbers: []
      };
    }

    // Check for consistency - Only look for successful responses
    const exactMatch = await Chat.findOne({
      question: question.trim().toLowerCase(),
      success: true  // Only successful responses for consistency
    });

    if (exactMatch) {
      const newChat = new Chat({
        sessionId,
        messageId,
        question: question.trim(),
        answer: exactMatch.answer,
        pageNumbers: exactMatch.pageNumbers,
        success: true
      });
      await newChat.save();
      
      return {
        messageId,
        answer: exactMatch.answer,
        pageNumbers: exactMatch.pageNumbers,
        consistent: true
      };
    }

    // Get conversation history - Only successful responses
    const recentChats = await Chat.find({ 
      sessionId,
      success: true  // Only successful responses for context
    })
      .sort({ timestamp: -1 })
      .limit(3);

    const conversationHistory = recentChats
      .reverse()
      .map(chat => `Q: ${chat.question}\nA: ${chat.answer}`)
      .join('\n\n');

    // Vector search
    let context = '';
    let pageNumbers = [];
    if (vectorStore) {
      try {
        const searchResults = await vectorStore.similaritySearch(question, 5);
        context = searchResults
          .map(result => result.pageContent)
          .join('\n\n');
        pageNumbers = searchResults
          .map(result => result.metadata.pageNumber)
          .filter(page => page && page > 0);
        pageNumbers = [...new Set(pageNumbers)].sort((a, b) => a - b);
      } catch (searchError) {
        console.error('Vector search error:', searchError.message);
      }
    }

    let answer;
    let isSuccess = true;

    if (!context) {
      answer = `## Information Not Available

I don't have relevant information in the hospital guidelines to answer this question.

## Please Check
• PDF documents are uploaded to the system
• The question relates to hospital procedures or guidelines
• System has finished processing documents`;

      isSuccess = false; // This is not a successful response
    } else {
      try {
        // Generate response
        const promptText = await promptTemplate.format({
          context,
          history: conversationHistory || 'No previous conversation',
          question
        });

        const response = await llm.invoke(promptText);
        answer = formatResponse(response.content);

        // Clean page references
        answer = answer
          .replace(/\(Page\s+\d+[^)]*\)/gi, '')
          .replace(/Page\s+\d+[^.]*\.?/gi, '')
          .trim();

        // Check if this is an error response from AI
        if (isErrorResponse(answer)) {
          isSuccess = false;
        }

      } catch (error) {
        console.error('Error generating answer:', error);
        answer = `## System Error

I apologize, but I encountered an error while processing your question.

## Please Try
• Asking the question again
• Using different wording
• Checking if the system is properly initialized`;

        isSuccess = false; // This is an error response
      }
    }

    // Save to database with success flag
    const chat = new Chat({
      sessionId,
      messageId,
      question: question.trim().toLowerCase(),
      answer,
      pageNumbers,
      success: isSuccess  // Important: Mark whether this was successful
    });
    await chat.save();

    return {
      messageId,
      answer,
      pageNumbers
    };

  } catch (error) {
    console.error('Error in getAnswer:', error);
    const errorAnswer = `## System Error

I apologize, but I encountered an error while processing your question.

## Please Try
• Asking the question again
• Using different wording
• Checking if the system is properly initialized`;

    // Even save errors to database but mark as unsuccessful
    try {
      const Chat = mongoose.model('Chat');
      const errorChat = new Chat({
        sessionId,
        messageId,
        question: question.trim().toLowerCase(),
        answer: errorAnswer,
        pageNumbers: [],
        success: false  // Mark as unsuccessful
      });
      await errorChat.save();
    } catch (saveError) {
      // Ignore save errors for error responses
    }

    return { messageId, answer: errorAnswer, pageNumbers: [] };
  }
}

// Export all functions
module.exports = {
  initializeRAG,
  getAnswer,
  processPDFs,
  initializeVectorStore,
  formatResponse
};