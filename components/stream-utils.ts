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

  // Throttle message updates
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
      const { done, value } = await reader.read();
      if (done) break;

      const textChunk = decoder.decode(value);
      const jsonResponses = textChunk
        .split('\n')
        .filter(line => line.trim() !== '');

      for (const jsonStr of jsonResponses) {
        try {
          const jsonResponse = JSON.parse(jsonStr);
          
          // Capture context data
          if (jsonResponse.context) {
            finalContext = jsonResponse.context;
          }

          // Formatting handlers
          let content = jsonResponse.response || '';
          if (content === '\\boxed{}') {
            content = '\\boxed{\\ }';
          } else if (content.startsWith('\\boxed') && !content.endsWith('}')) {
            content += '}';
          }

          // Code block detection
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

    // Final context update
    if (typeof onContext === 'function' && finalContext.length > 0) {
      onContext(finalContext);
    }

    // Final message update
    setMessages(prev => 
      prev.map(msg => 
        msg.id === tempAssistantId 
          ? { ...msg, content: assistantMessage } 
          : msg
      )
    );
  } catch (error) {
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