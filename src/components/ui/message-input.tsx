"use client"

import React, { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Paperclip, Square } from "lucide-react"
import { omit } from "remeda"

import { cn } from "@/lib/utils"
import { useAutosizeTextArea } from "@/hooks/use-autosize-textarea"
import { Button } from "@/components/ui/button"
import { FilePreview } from "@/components/ui/file-preview"

interface MessageInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>
  allowAttachments?: boolean
  files?: File[] | null
  setFiles?: React.Dispatch<React.SetStateAction<File[] | null>>
  stop?: () => void
  isGenerating?: boolean
  submitOnEnter?: boolean
}

// Supported file types
const SUPPORTED_FILE_TYPES = [
  "image/*",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json"
].join(",");

export function MessageInput({
  placeholder = "Ask AI...",
  className,
  onKeyDown: onKeyDownProp,
  submitOnEnter = true,
  stop,
  isGenerating,
  ...props
}: MessageInputProps) {
  const [isDragging, setIsDragging] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const showFileList = props.allowAttachments && props.files && props.files.length > 0

  useAutosizeTextArea({
    ref: textAreaRef as React.RefObject<HTMLTextAreaElement>,
    maxHeight: 240,
    borderWidth: 1,
    dependencies: [props.value, showFileList],
  })

  const addFiles = (files: File[] | null) => {
    if (props.allowAttachments && props.setFiles) {
      props.setFiles((currentFiles) => {
        if (currentFiles === null) return files
        if (files === null) return currentFiles
        return [...currentFiles, ...files]
      })
    }
  }

  const onDragOver = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return
    event.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return
    event.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (event: React.DragEvent) => {
    setIsDragging(false)
    if (props.allowAttachments !== true) return
    event.preventDefault()
    const dataTransfer = event.dataTransfer
    if (dataTransfer.files.length) {
      addFiles(Array.from(dataTransfer.files))
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
    onKeyDownProp?.(event)
  }

  return (
    <div 
      className="relative flex w-full grow flex-col overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <textarea
        aria-label="Write your prompt here"
        placeholder={placeholder}
        ref={textAreaRef}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full grow resize-none rounded-lg border border-input bg-transparent p-3 pr-20 text-sm ring-offset-background transition-[border] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          showFileList && "pb-16",
          className
        )}
        {...(props.allowAttachments
          ? omit(props, ["allowAttachments", "files", "setFiles"])
          : omit(props, ["allowAttachments"]))}
      />

      {props.allowAttachments && (
        <div className="absolute inset-x-3 bottom-0 z-20 overflow-x-scroll py-2">
          <div className="flex space-x-3">
            <AnimatePresence mode="popLayout">
              {props.files?.map((file) => (
                <FilePreview
                  key={file.name + String(file.lastModified)}
                  file={file}
                  onRemove={() => {
                    if (props.setFiles) {
                      props.setFiles((files) => {
                        if (!files) return null
                        const filtered = Array.from(files).filter(f => f !== file)
                        if (filtered.length === 0) return null
                        return filtered
                      })
                    }
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="absolute right-4 top-4 z-20 flex gap-2">
        {props.allowAttachments && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label="Attach a file"
            onClick={async () => {
              const files = await showFileUploadDialog()
              addFiles(files)
            }}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
        {isGenerating && stop ? (
          <Button
            type="button"
            size="icon"
            className="h-8 w-8"
            aria-label="Stop generating"
            onClick={stop}
          >
            <Square className="h-3 w-3 animate-pulse" fill="currentColor" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 transition-opacity"
            aria-label="Send message"
            disabled={props.value === "" || isGenerating}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>

      {props.allowAttachments && <FileUploadOverlay isDragging={isDragging} />}
    </div>
  )
}
MessageInput.displayName = "MessageInput"

// File upload dialog
const showFileUploadDialog = async (): Promise<File[] | null> => {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = SUPPORTED_FILE_TYPES;
    
    input.onchange = () => {
      const files = input.files;
      resolve(files ? Array.from(files) : null);
    };
    
    input.click();
  });
};

// File upload overlay
function FileUploadOverlay({ isDragging }: { isDragging: boolean }) {
  if (!isDragging) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 p-8"
    >
      <p className="text-center text-sm font-medium">Drop files to attach</p>
    </motion.div>
  );
}

// Interrupt prompt
function InterruptPrompt({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      className="pointer-events-none absolute inset-x-0 bottom-full z-50 mb-2"
    >
      <div className="mx-auto w-fit rounded-lg border bg-background px-4 py-2 text-center text-sm">
        <p>Press Enter again to stop generating</p>
      </div>
    </motion.div>
  );
}
