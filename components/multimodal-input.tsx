// src/components/multimodal-input.tsx
'use client';

import cx from 'classnames';
import React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  memo
} from 'react';
import { toast } from 'sonner';
import { useWindowSize } from 'usehooks-ts';
import { ArrowUpIcon, StopIcon } from './icons';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import { processAIStream } from './stream-utils';
import { Message, CreateMessage, ChatRequestOptions } from 'ai';

const API_ENDPOINT = 'http://36.189.234.154:10180/api/generate';
const DEFAULT_MODEL = 'deepseek-r1:32b';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
}

function PureMultimodalInput({
  chatId,
  messages,
  setMessages,
  className,
  input,
  setInput,
  isLoading,
  stop: onStop,
  append,
}: {
  chatId: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  className?: string;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  stop: () => void;
  append: (message: ChatMessage) => Promise<void>;
}) {
  const controllerRef = useRef<AbortController>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const tempAssistantIdRef = useRef<string>();
  const contextRef = useRef<number[]>([]);
  const [localIsLoading, setLocalIsLoading] = useState(false);

  const actualIsLoading = isLoading || localIsLoading;

  useEffect(() => {
    contextRef.current = [];
  }, [chatId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, [input]);

  const submitForm = useCallback(async () => {
    const currentInput = input.trim();
    if (!currentInput || actualIsLoading) return;

    // 立即清空输入框
    setInput('');
    setLocalIsLoading(true);
    const userMessageId = Date.now().toString();
    tempAssistantIdRef.current = `temp-${Date.now()}`;

    try {
      // 使用当前输入的快照
      await append({
        id: userMessageId,
        content: currentInput,
        role: 'user',
        createdAt: new Date()
      });

      setMessages(prev => [...prev, {
        id: tempAssistantIdRef.current!,
        content: '',
        role: 'assistant',
        createdAt: new Date()
      }]);

      controllerRef.current = new AbortController();
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Request-Headers': 'Content-Type',
          'Access-Control-Request-Method': 'POST'
        },
        mode: 'cors', // 强制 CORS 模式
        body: JSON.stringify({ 
          model: DEFAULT_MODEL,
          prompt: currentInput,
          // stream: true,
          context: contextRef.current.length > 0 ? contextRef.current : undefined
        }),
        signal: controllerRef.current.signal
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const handleNewContext = (newContext: number[]) => {
        contextRef.current = newContext;
      };

      await processAIStream(
        response,
        setMessages,
        tempAssistantIdRef.current!,
        controllerRef.current,
        handleNewContext
      );

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        // 出错时恢复输入内容
        setInput(currentInput);
        toast.error(error.message || '请求失败');
        setMessages(prev => {
          const lastIndex = prev.findIndex(m => m.id === tempAssistantIdRef.current);
          return lastIndex !== -1 ? prev.slice(0, lastIndex) : prev;
        });
        contextRef.current = [];
      }
    } finally {
      setLocalIsLoading(false);
      tempAssistantIdRef.current = undefined;
      if (width! > 768) textareaRef.current?.focus();
    }
  }, [input, actualIsLoading, setMessages, width, setInput, append]);

  const handleStop = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      setMessages(prev => {
        const lastIndex = prev.findIndex(m => m.id === tempAssistantIdRef.current);
        return lastIndex !== -1 ? prev.slice(0, lastIndex) : prev;
      });
      contextRef.current = [];
    }
    onStop?.();
  }, [setMessages, onStop]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 && (
        <SuggestedActions 
          chatId={chatId}
          append={async (message, _) => {
            await append({
              id: Date.now().toString(),
              content: message.content,
              role: 'user',
              createdAt: new Date()
            });
            return '';
          }}
        />
      )}

      <Textarea
        ref={textareaRef}
        placeholder="输入消息..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className={cx(
          'min-h-[24px] max-h-[75vh] resize-none rounded-2xl bg-muted pb-10',
          'ring-2 ring-transparent focus:ring-primary/50 transition-all',
          className
        )}
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !actualIsLoading) {
            e.preventDefault();
            submitForm();
          }
        }}
      />

      <div className="absolute bottom-0 right-0 p-2 flex gap-2">
        {actualIsLoading ? (
          <Button
            variant="outline"
            onClick={handleStop}
            className="rounded-full p-2 hover:bg-destructive/10 hover:text-destructive"
            aria-label="停止生成"
          >
            <div className="animate-pulse">
              <StopIcon size={16} />
            </div>
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={submitForm}
            disabled={!input.trim()}
            className="rounded-full p-2 hover:bg-primary/10 hover:text-primary"
            aria-label="发送消息"
          >
            <ArrowUpIcon size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(PureMultimodalInput, (prev, next) => 
  equal(prev.messages, next.messages) && 
  prev.className === next.className &&
  prev.chatId === next.chatId &&
  prev.input === next.input &&
  prev.isLoading === next.isLoading &&
  prev.stop === next.stop
);