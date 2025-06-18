import React, { useState, useRef, useEffect } from 'react';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your SSH Terminal assistant. How can I help you today?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const sendMessage = () => {
    if (inputValue.trim() === '') return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate bot response
    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: getBotResponse(inputValue),
        sender: 'bot'
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const getBotResponse = (userInput) => {
    const input = userInput.toLowerCase();
    
    if (input.includes('help') || input.includes('commands')) {
      return "Here are some common SSH commands:\n• ls - list files\n• cd - change directory\n• pwd - show current directory\n• cat - view file contents\n• nano - edit files";
    } else if (input.includes('container') || input.includes('docker')) {
      return "You can create containers using the 'Create' button, connect to them, and remove them with the red X button. Each container runs an SSH server you can connect to.";
    } else if (input.includes('connect') || input.includes('ssh')) {
      return "To connect: 1) Create a container first, 2) Fill in host (localhost), port (auto-filled), username (root), and password, 3) Click Connect button.";
    } else if (input.includes('port') || input.includes('error')) {
      return "If you're having connection issues, make sure: 1) Container is running, 2) Port is correct, 3) Username/password are valid, 4) Try refreshing the page.";
    } else {
      return "I can help you with SSH commands, container management, connection issues, and terminal usage. What would you like to know?";
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

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
          backgroundColor: '#3498db',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#2980b9';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = '#3498db';
          e.target.style.transform = 'scale(1)';
        }}
        title="Open SSH Assistant"
      >
        💬
      </button>

      {/* Chatbox - Appears when button is clicked */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '350px',
            height: '450px',
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
              <h4 style={{ margin: 0, fontSize: '16px' }}>SSH Assistant</h4>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>Online</span>
            </div>
            <button
              onClick={toggleChatbot}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '5px'
              }}
            >
              ×
            </button>
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
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 12px',
                    borderRadius: '18px',
                    backgroundColor: message.sender === 'user' ? '#3498db' : '#7f8c8d',
                    color: 'white',
                    fontSize: '14px',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}
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
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about SSH..."
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid #7f8c8d',
                borderRadius: '20px',
                backgroundColor: '#34495e',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                padding: '10px 15px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;