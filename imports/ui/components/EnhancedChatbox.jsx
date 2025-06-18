import React, { useState, useRef, useEffect } from 'react';

const EnhancedChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: "Hello! I'm Claude, your SSH Terminal assistant. I can help you with commands, troubleshooting, and container management. What would you like to know?", 
      sender: 'bot' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
    setError(null);
  };

  const sendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Prepare messages for API - include conversation context
      const conversationMessages = [
        ...messages.filter(m => m.sender === 'user' || m.sender === 'bot').slice(-10), // Last 10 messages for context
        userMessage
      ].map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      console.log('Sending request to /api/chat-simple with:', {
        message: userMessage.text,
        messages: conversationMessages
      });

      const response = await fetch('/api/chat-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage.text,
          messages: conversationMessages 
        }),
        signal: abortControllerRef.current.signal
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: `HTTP ${response.status}` };
        }
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      const botResponse = {
        id: Date.now() + 1,
        text: data.response || "I apologize, but I couldn't generate a response. Please try again.",
        sender: 'bot'
      };

      setMessages(prev => [...prev, botResponse]);

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }

      console.error('Chat error:', error);
      setError(error.message);

      const errorMessage = {
        id: Date.now() + 1,
        text: `I'm sorry, I encountered an error: ${error.message}. Please try again.`,
        sender: 'bot',
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now(),
      text: "Chat cleared! How can I help you with your SSH terminal today?",
      sender: 'bot'
    }]);
    setError(null);
  };

  const insertQuickCommand = (command) => {
    setInputValue(command);
  };

  const quickCommands = [
    { label: "List files", command: "How do I list files in the current directory?" },
    { label: "SSH help", command: "What are the most common SSH commands?" },
    { label: "Container status", command: "How do I check if my Docker container is running?" },
    { label: "File permissions", command: "How do I change file permissions in Linux?" },
    { label: "Process management", command: "How do I see running processes and kill them?" }
  ];

  // Chat SVG Icon Component
  const ChatIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );

  // Close/X SVG Icon Component
  const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M18 6L6 18M6 6l12 12" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );

  // Send SVG Icon Component
  const SendIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );

  // Trash SVG Icon Component
  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <>
      {/* Chatbot Button - Fixed position at bottom right */}
      <button
        onClick={toggleChatbot}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: isOpen ? '#e74c3c' : '#3498db',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
        title={isOpen ? "Close SSH Assistant" : "Open SSH Assistant"}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

      {/* Chatbox - Appears when button is clicked */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '400px',
            height: '600px',
            backgroundColor: '#2c3e50',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Chatbox Header */}
          <div
            style={{
              backgroundColor: '#34495e',
              color: 'white',
              padding: '15px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '12px 12px 0 0'
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '16px' }}>Claude SSH Assistant</h4>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>
                {isLoading ? 'Thinking...' : 'Ready to help'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={clearChat}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                title="Clear chat"
              >
                <TrashIcon />
              </button>
              <button
                onClick={toggleChatbot}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              padding: '8px 15px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Quick Commands */}
          <div style={{
            backgroundColor: '#34495e',
            padding: '8px 15px',
            borderBottom: '1px solid #2c3e50'
          }}>
            <div style={{ fontSize: '12px', marginBottom: '8px', color: '#bdc3c7' }}>
              Quick commands:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {quickCommands.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => insertQuickCommand(cmd.command)}
                  style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              padding: '10px',
              overflowY: 'auto',
              backgroundColor: '#34495e'
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: message.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    backgroundColor: message.isError ? '#e74c3c' : (message.sender === 'user' ? '#3498db' : '#7f8c8d'),
                    color: 'white',
                    fontSize: '14px',
                    whiteSpace: 'pre-line',
                    wordBreak: 'break-word'
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: '12px'
              }}>
                <div style={{
                  backgroundColor: '#7f8c8d',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  fontSize: '14px'
                }}>
                  <span>Claude is thinking</span>
                  <span style={{ animation: 'blink 1.5s infinite' }}>...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: '15px',
              borderTop: '1px solid #7f8c8d',
              backgroundColor: '#2c3e50',
              display: 'flex',
              gap: '10px'
            }}
          >
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about SSH commands, Linux, containers..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #7f8c8d',
                borderRadius: '20px',
                backgroundColor: '#34495e',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                resize: 'none',
                minHeight: '20px',
                maxHeight: '80px',
                fontFamily: 'inherit'
              }}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              style={{
                padding: '12px 16px',
                backgroundColor: isLoading || !inputValue.trim() ? '#7f8c8d' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isLoading ? (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff40',
                  borderTop: '2px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default EnhancedChatbot;