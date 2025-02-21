import * as React from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import type { CSSProperties, ComponentProps, ElementType } from 'react'
import { cn } from "@/lib/utils"

import { CopyButton } from "@/components/ui/copy-button"

interface MarkdownRendererProps {
  children: string
}

interface CodeBlockProps {
  children: React.ReactNode
  className?: string
  node: {
    properties?: {
      className?: string[]
    }
  }
}

export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  // Cast components to Components type to handle complex type issues
  const components = {
    h1: withClass("h1", "text-4xl font-bold mt-6 mb-4"),
    h2: withClass("h2", "text-3xl font-bold mt-6 mb-4"),
    h3: withClass("h3", "text-2xl font-bold mt-6 mb-4"),
    h4: withClass("h4", "text-xl font-bold mt-4 mb-2"),
    h5: withClass("h5", "text-lg font-bold mt-4 mb-2"),
    h6: withClass("h6", "text-base font-bold mt-4 mb-2"),
    p: withClass("p", "leading-7 [&:not(:first-child)]:mt-6"),
    ul: withClass("ul", "my-6 ml-6 list-disc [&>li]:mt-2"),
    ol: withClass("ol", "my-6 ml-6 list-decimal [&>li]:mt-2"),
    li: withClass("li", ""),
    blockquote: withClass(
      "blockquote",
      "mt-6 border-l-2 pl-6 italic [&>*]:text-muted-foreground"
    ),
    img: withClass("img", "rounded-md border"),
    hr: withClass("hr", "my-4 md:my-8"),
    table: withClass("table", "my-6 w-full overflow-y-auto"),
    tr: withClass("tr", "m-0 border-t p-0 even:bg-muted"),
    th: withClass(
      "th",
      "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right"
    ),
    td: withClass(
      "td",
      "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
    ),
    pre: CodeBlock as Components["pre"],
    code: withClass("code", "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm"),
    a: withClass("a", "font-medium text-primary underline underline-offset-4")
  } as Components

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      className="markdown-body"
    >
      {children}
    </ReactMarkdown>
  )
}

interface HighlightedPreProps {
  children: string
  language: string
  style?: Record<string, CSSProperties>
}

const HighlightedPreComponent = React.memo(
  function HighlightedPreComponent({ children, language, style = {} }: HighlightedPreProps) {
    return (
      <SyntaxHighlighter
        PreTag="div"
        language={language}
        style={style}
        className="rounded-md"
      >
        {children}
      </SyntaxHighlighter>
    )
  }
)

HighlightedPreComponent.displayName = "HighlightedPreComponent"

const CodeBlock = React.memo<CodeBlockProps>(
  function CodeBlock({ children, className, node }) {
    const match = /language-(\w+)/.exec(className || "")
    const lang = match?.[1] || node.properties?.className?.[0]?.replace("language-", "") || "text"

    const childrenString = typeof children === "string" 
      ? children 
      : React.Children.toArray(children)
          .map(child => typeof child === "string" ? child : "")
          .join("")

    return (
      <HighlightedPreComponent
        language={lang}
        style={{}}
      >
        {childrenString}
      </HighlightedPreComponent>
    )
  }
)

CodeBlock.displayName = "CodeBlock"

function withClass<T extends ElementType>(tag: T, className: string) {
  const Component = React.forwardRef<HTMLElement, ComponentProps<T>>(
    function Component({ className: additionalClassName, ...props }, ref) {
      return React.createElement(tag, {
        ...props,
        ref,
        className: cn(className, additionalClassName)
      })
    }
  )
  
  Component.displayName = `withClass(${tag})`
  return Component
}

export default MarkdownRenderer
