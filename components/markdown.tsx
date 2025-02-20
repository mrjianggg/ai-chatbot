import Link from 'next/link';
import React, { memo, ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CodeBlock } from './code-block';

type SimpleProps = { children?: ReactNode };

// 新增数学符号转换函数
const convertMathSymbols = (text: string) => {
  return text
    .replace(/(^|\s)\\times(\s|$)/g, '$1×$2')
    .replace(/(^|\s)\\div(\s|$)/g, '$1÷$2')
    .replace(/(^|\s)\\pm(\s|$)/g, '$1±$2')
    .replace(/(^|\s)\\cdot(\s|$)/g, '$1·$2')
    .replace(/(^|\s)\\leq(\s|$)/g, '$1≤$2')
    .replace(/(^|\s)\\geq(\s|$)/g, '$1≥$2');
};

const components: Partial<Components> = {
  // @ts-expect-error
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  // 新增数学公式处理
  math: ({ children }: SimpleProps) => (
    <span className="math-inline">{convertMathSymbols(String(children))}</span>
  ),
  inlineMath: ({ children }: SimpleProps) => (
    <span className="math-inline">{convertMathSymbols(String(children))}</span>
  ),
  // 修改文本节点处理
  text: ({ node, children, ...props }) => {
    const processedText = convertMathSymbols(String(children));
    return <>{processedText}</>;
  },
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
};

const remarkPlugins = [remarkGfm, remarkMath]; // 添加 remark-math

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  // 预处理内容
  const processedContent = convertMathSymbols(children)
    .replace(/\$\$(.*?)\$\$/g, (_, p1) => `\$$${p1}\$$`)  // 转换块级公式
    .replace(/\$(.*?)\$/g, (_, p1) => `\$$${p1}\$$`);    // 转换行内公式

  return (
    <ReactMarkdown 
      remarkPlugins={remarkPlugins}
      rehypePlugins={[rehypeKatex]}  // 添加 Katex 支持
      components={components}
    >
      {processedContent}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);