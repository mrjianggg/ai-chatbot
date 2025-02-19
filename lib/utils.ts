import type { Document } from '@/lib/db/schema';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 添加核心fetcher函数
export const fetcher = async <T = any>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    const error = new Error(errorData.message || 'API请求失败');
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

// 样式工具函数保持不变
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// UUID生成器（保持不变）
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 简化后的消息接口
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

// 精简消息转换逻辑（移除工具调用处理）
export function convertToUIMessages(messages: Array<DBMessage>): Array<Message> {
  return messages.map(message => ({
    id: message.id,
    role: message.role as 'user' | 'assistant',
    content: typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content),
    createdAt: message.createdAt,
    attachments: message.attachments as Message['attachments']
  }));
}

// 简化消息清洗逻辑（仅过滤空内容）
export function sanitizeUIMessages(messages: Array<Message>): Array<Message> {
  return messages.filter(msg => 
    msg.content.trim().length > 0 || 
    (msg.attachments?.length ?? 0) > 0
  );
}

// 新增流式处理工具
export async function* processTextStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value);
    }
  } finally {
    reader.releaseLock();
  }
}

// 本地存储工具（保持不变）
export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

// 文档时间戳工具（保持不变）
export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();
  return documents[index].createdAt;
}