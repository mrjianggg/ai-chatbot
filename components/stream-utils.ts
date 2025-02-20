// components/stream-utils.ts
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
}

export const processAIStream = async (
  response: Response,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  tempAssistantId: string,
  controller: AbortController,
  onContext?: (context: number[]) => void
) => {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let assistantMessage = '';
  let isCodeBlock = false;
  let updatePending = false;
  let finalContext: number[] = [];

  const throttledUpdate = () => {
    if (!updatePending) {
      updatePending = true;
      requestAnimationFrame(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempAssistantId 
              ? { ...msg, content: assistantMessage } 
              : msg
          )
        );
        updatePending = false;
      });
    }
  };

  try {
    while (true) {
      // 添加中止检查
      if (controller.signal.aborted) {
        console.log('Stream processing aborted');
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      const textChunk = decoder.decode(value);
      const jsonResponses = textChunk
        .split('\n')
        .filter(line => line.trim() !== '');

      for (const jsonStr of jsonResponses) {
        try {
          const jsonResponse = JSON.parse(jsonStr);
          
          if (jsonResponse.context) {
            finalContext = jsonResponse.context;
          }

          let content = jsonResponse.response || '';
          content = content
            .replace(/\\times\b/g, '×')
            .replace(/\\div\b/g, '÷')
            .replace(/\\pm\b/g, '±');

          if (content === '\\boxed{}') {
            content = '\\boxed{\\ }';
          } else if (content.startsWith('\\boxed') && !content.endsWith('}')) {
            content += '}';
          }

          if (content.includes('```')) {
            isCodeBlock = !isCodeBlock;
          }

          assistantMessage += content;
          throttledUpdate();
        } catch (e) {
          console.error('JSON parse error:', e);
        }
      }
    }

    if (typeof onContext === 'function' && finalContext.length > 0) {
      onContext(finalContext);
    }

    setMessages(prev => 
      prev.map(msg => 
        msg.id === tempAssistantId 
          ? { ...msg, content: assistantMessage } 
          : msg
      )
    );
  } catch (error) {
    // 关键修复：忽略中止错误
    // @ts-ignore 强制忽略类型检查
    if (error && error.name === 'AbortError') {
      console.log('Stream processing aborted normally');
      return;
    }
    
    console.error('Stream processing error:', error);
    setMessages(prev => {
      const last = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          content: `⚠️ Generation interrupted. Current progress:\n${assistantMessage}`
        }
      ];
    });
    throw error;
  }
};