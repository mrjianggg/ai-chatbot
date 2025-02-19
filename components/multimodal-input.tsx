'use client';

import cx from 'classnames';
import React from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import equal from 'fast-deep-equal';
import { generateUUID } from '@/lib/utils';
import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachmentA } from './preview-attachment-a';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface Attachment {
  url: string;
  name: string;
  contentType: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
  attachments?: Attachment[];
}

function PureMultimodalInput({
  chatId,
  messages,
  setMessages,
  className,
}: {
  chatId: string;
  messages: Array<Message>;
  setMessages: React.Dispatch<React.SetStateAction<Array<Message>>>;
} & React.ComponentProps<typeof Button>) {
  const [input, setInput] = React.useState('');
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [uploadQueue, setUploadQueue] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [previousContext, setPreviousContext] = React.useState<number[]>([]);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadQueue(prev => [...prev, ...files.map(f => f.name)]);
    
    files.forEach(file => {
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(n => n !== file.name));
        setAttachments(prev => [...prev, {
          url: URL.createObjectURL(file),
          name: file.name,
          contentType: file.type
        }]);
      }, 1500);
    });
  };

  const stop = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  const processResponse = (text: string) => {
    let processed = text
      .replace(/<think>|<\/think>/g, '')
      .replace(/(\\\w+)\s*/g, '$1')
      .replace(/\\boxed{([^}]*)/g, (_, content) => `\\boxed{${content}}`)
      .replace(/\\([()])/g, '$1')
      .replace(/\n{3,}/g, '\n\n');

    const openMathBlocks = (processed.match(/\\(?:begin|boxed){/g) || []).length;
    const closeMathBlocks = (processed.match(/\\(?:end|boxed)}/g) || []).length;
    if (openMathBlocks > closeMathBlocks) {
      processed += '}'.repeat(openMathBlocks - closeMathBlocks);
    }

    return processed;
  };

  const submitForm = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = {
      id: generateUUID(),
      role: 'user',
      content: input,
      createdAt: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined
    };

    const assistantMessageId = generateUUID();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date()
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setAttachments([]);
    setUploadQueue([]);

    try {
      setIsLoading(true);
      abortControllerRef.current = new AbortController();
      console.log('previousContext===',previousContext);
      let contextData = [];
      if (previousContext.length > 0) {
        contextData = previousContext; 
      }else{
        contextData = [
            151644,
            6023,
            151645,
            151648,
            271,
            151649,
            198,
            198,
            9707,
            0,
            2585,
            646,
            358,
            7789,
            498,
            3351,
            30,
            26525,
            232
        ]
      }

      let bodyData  = {
        model: 'deepseek-r1:32b',
        prompt: input,
        context: contextData,
        stream: true
      }

      const response = await fetch('http://159.135.192.195:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
        // signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(`请求失败：${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let pendingChunk = '';

      while (reader) {
        const { done, value } = await reader.read();
        

        buffer += decoder.decode(value, { stream: true });
        
        while (true) {
          const endIndex = buffer.indexOf('}') + 1;
          try {
            const jsonStr = buffer.slice(0, endIndex);
            const data = JSON.parse(jsonStr);
            console.log('data===',data);
            if (data.context) {
              console.log('data.context===',data.context);
              // 在收到完成响应时保存context
              setPreviousContext(data.context);
            }
            
            if (data.response) {
              pendingChunk += data.response
                .replace(/\\u([\dA-F]{4})/gi, (_, hex) => 
                  String.fromCharCode(parseInt(hex, 16))
                );

              if (pendingChunk.includes('\n') || data.done) {
                fullResponse += processResponse(pendingChunk);
                pendingChunk = '';
                
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: fullResponse } 
                    : msg
                ));
              }
            }
            
            buffer = buffer.slice(endIndex);
          } catch (error) {
            break;
          }
        }
        if (done) break;
      }

      if (pendingChunk) {
        fullResponse += processResponse(pendingChunk);
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: fullResponse } 
            : msg
        ));
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error(error.message || '请求失败');
        setMessages(prev => prev.filter(msg => 
          msg.id !== userMessage.id && msg.id !== assistantMessageId
        ));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="relative w-full flex flex-col gap-4">
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {attachments.map((file) => (
            <PreviewAttachmentA key={file.url} attachment={file} />
          ))}
          {uploadQueue.map((name) => (
            <PreviewAttachmentA
              key={name}
              attachment={{ url: '', name, contentType: '' }}
              isUploading
            />
          ))}
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          className={cx(
            'min-h-[40px] max-h-[60vh] resize-none pr-12',
            className
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitForm();
            }
          }}
        />
        
        <div className="absolute right-2 bottom-2 flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon className="h-4 w-4" />
          </Button>
          
          {isLoading ? (
            <Button
              size="icon"
              className="h-8 w-8"
              onClick={stop}
            >
              <StopIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-8 w-8"
              onClick={submitForm}
              disabled={!input.trim() && !attachments.length}
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = React.memo(
  PureMultimodalInput,
  (prev, next) => equal(prev.messages, next.messages) && prev.input === next.input
);