"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MessageInputProps {
  onSendMessage: (message: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTyping,
  disabled = false,
  isSending = false,
  placeholder = "Nhập tin nhắn...",
  maxLength = 2000,
  className = ''
}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle typing indicator
  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 2000);
  }, [isTyping, onTyping]);

  const handleTypingStop = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
  }, [isTyping, onTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Enforce max length
    if (value.length <= maxLength) {
      setMessage(value);
      
      // Handle typing indicator
      if (value.trim().length > 0) {
        handleTypingStart();
      } else {
        handleTypingStop();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled || isSending) {
      return;
    }

    try {
      // Stop typing indicator immediately
      handleTypingStop();
      
      // Send message
      await onSendMessage(trimmedMessage);
      
      // Clear input
      setMessage('');
      
      // Focus input for next message
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Keep the message in input if sending fails
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const characterCount = message.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount >= maxLength;

  return (
    <div className={`border-t border-gray-200 bg-white p-3 ${className}`}>
      <form onSubmit={handleSubmit}>
        {/* Input container */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              type="text"
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isSending}
              className={`rounded-full border-gray-300 bg-gray-100 px-4 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${isOverLimit ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              aria-label="Nhập tin nhắn hỗ trợ"
            />
            
            {/* Character counter */}
            {(isNearLimit || isOverLimit) && (
              <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-xs ${
                isOverLimit ? 'text-red-500' : 'text-yellow-600'
              }`}>
                {characterCount}/{maxLength}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled || isSending || isOverLimit}
            className={`
              inline-flex items-center justify-center h-8 w-8 rounded-full transition-all duration-150
              ${message.trim() && !disabled && !isSending && !isOverLimit
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
            aria-label="Gửi tin nhắn"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Error message for character limit */}
        {isOverLimit && (
          <p className="text-xs text-red-500 mt-2 pl-4">
            Tin nhắn không được vượt quá {maxLength} ký tự
          </p>
        )}
      </form>
    </div>
  );
};