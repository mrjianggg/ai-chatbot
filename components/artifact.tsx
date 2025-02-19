// artifact.tsx（完整修改版）
import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { useSidebar } from './ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import { imageArtifact } from '@/artifacts/image/client';
import { codeArtifact } from '@/artifacts/code/client';
import { sheetArtifact } from '@/artifacts/sheet/client';
import { textArtifact } from '@/artifacts/text/client';
import equal from 'fast-deep-equal';

// 自定义消息类型（替换原AI SDK类型）
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  attachments?: Array<{
    url: string;
    name: string;
    contentType: string;
  }>;
}

export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
];
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: 'streaming' | 'idle';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

function PureArtifact({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  votes,
  isReadonly,
}: {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: UIArtifact['attachments'];
  setAttachments: (attachments: UIArtifact['attachments']) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  votes: Vote[] | undefined;
  isReadonly: boolean;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  // 使用修复后的fetcher
  const { data: documents, mutate: mutateDocuments } = useSWR<Document[]>(
    artifact.documentId !== 'init' ? `/api/document?id=${artifact.documentId}` : null,
    fetcher
  );

  // ... [保持其他状态和逻辑不变]

  // 自定义append函数（替换原AI SDK实现）
  const append = useCallback(async (message: Message) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, message],
          model: "deepseek-r1:32b",
          attachments: message.attachments
        })
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      if (!reader) return;

      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        fullResponse += chunk;
        setMessages(prev => [
          ...prev.slice(0, -1), 
          {
            ...prev[prev.length-1],
            content: fullResponse
          }
        ]);
      }
    } catch (error) {
      console.error('API调用失败:', error);
      throw error;
    }
  }, [messages, setMessages]);

  // 自定义reload函数
  const reload = useCallback(async () => {
    const lastMessage = messages[messages.length -1];
    if (lastMessage?.role === 'user') {
      await append(lastMessage);
    }
  }, [messages, append]);

  // 自定义handleSubmit（替换原AI SDK实现）
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    
    const userMessage: Message = {
      id: generateUUID(),
      content: input,
      role: 'user',
      createdAt: new Date(),
      attachments
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);

    try {
      await append(userMessage);
    } catch (error) {
      console.error('消息提交失败:', error);
      setMessages(prev => [...prev.slice(0, -1)]);
    }
  }, [input, attachments, append, setInput, setAttachments, setMessages]);

  // ... [保持其余UI渲染逻辑不变]

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-transparent"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {/* 保持原有DOM结构不变 */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  return equal(prevProps, nextProps);
});