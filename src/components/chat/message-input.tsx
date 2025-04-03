"use client"

import React, { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Paperclip, Square } from "lucide-react"
import { omit } from "remeda"

import { cn } from "@/lib/utils"
import { useAutosizeTextArea } from "@/hooks/use-autosize-textarea"
import { Button } from "@/components/ui/button"
import { FilePreview } from "@/components/chat/file-preview"

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  allowAttachments?: boolean
  files?: File[] | null
  setFiles?: React.Dispatch<React.SetStateAction<File[] | null>>
  stop?: () => void
  isGenerating?: boolean
  submitOnEnter?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
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
  placeholder = "Ask Anything...",
  className,
  onKeyDown: onKeyDownProp,
  submitOnEnter = true,
  stop,
  isGenerating,
  value,
  onChange,
  disabled,
  allowAttachments,
  files,
  setFiles,
}: MessageInputProps) {
  const [isDragging, setIsDragging] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const showFileList = allowAttachments && files && files.length > 0

  useAutosizeTextArea({
    ref: textAreaRef as React.RefObject<HTMLTextAreaElement>,
    maxHeight: 240,
    borderWidth: 1,
    dependencies: [value, showFileList],
  })

  const addFiles = (files: File[] | null) => {
    if (allowAttachments && setFiles) {
      setFiles((currentFiles) => {
        if (currentFiles === null) return files
        if (files === null) return currentFiles
        return [...currentFiles, ...files]
      })
    }
  }

  const onDragOver = (event: React.DragEvent) => {
    if (allowAttachments !== true) return
    event.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (event: React.DragEvent) => {
    if (allowAttachments !== true) return
    event.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (event: React.DragEvent) => {
    setIsDragging(false)
    if (allowAttachments !== true) return
    event.preventDefault()
    const dataTransfer = event.dataTransfer
    if (dataTransfer.files.length) {
      addFiles(Array.from(dataTransfer.files))
    }
  }

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (allowAttachments !== true) return
    
    const clipboardData = event.clipboardData
    
    // Check if there are files in the clipboard (images)
    if (clipboardData.files.length > 0) {
      event.preventDefault()
      
      // Get all files from clipboard
      const pastedFiles = Array.from(clipboardData.files)
      
      // Filter for supported file types
      const supportedFiles = pastedFiles.filter(file => {
        const fileType = file.type
        return fileType.startsWith('image/') || 
               fileType === 'application/pdf' || 
               fileType === 'text/plain' ||
               fileType === 'text/markdown' ||
               fileType === 'text/csv' ||
               fileType === 'application/json'
      })
      
      if (supportedFiles.length > 0) {
        addFiles(supportedFiles)
      }
    } else {
      // Handle long text pastes
      const pastedText = clipboardData.getData('text/plain')
      const TEXT_LENGTH_THRESHOLD = 1000 // Text longer than 1000 chars becomes a file
      
      if (pastedText && pastedText.length > TEXT_LENGTH_THRESHOLD) {
        // Prevent default paste to avoid text appearing in textarea
        event.preventDefault()
        
        // Create a new file from the pasted text
        const textFile = new File(
          [pastedText], 
          `pasted.txt`, 
          { type: 'text/plain' }
        )
        
        // Add the text file to the files
        addFiles([textFile])
      }
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
    onKeyDownProp?.(event)
  }

  // Handle onChange to convert from event to string value
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div 
      className="relative flex w-full grow flex-col overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95 rounded-lg"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <textarea
        aria-label="Write your message"
        placeholder={placeholder}
        ref={textAreaRef}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onChange={handleChange}
        className={cn(
          "w-full grow resize-none rounded-2xl border border-input bg-transparent p-3 pr-28 text-sm ring-offset-background transition-[border] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          showFileList && "pb-16",
          className
        )}
        value={value}
        disabled={disabled}
      />

      {allowAttachments && (
        <div className="absolute inset-x-3 bottom-0 z-20 overflow-x-auto py-2">
          <div className="flex space-x-3">
            <AnimatePresence mode="popLayout">
              {files?.map((file) => (
                <FilePreview
                  key={file.name + String(file.lastModified)}
                  file={file}
                  onRemove={() => {
                    if (setFiles) {
                      setFiles((files) => {
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

      <div className="absolute right-6 top-4 z-40 flex gap-4">
        {allowAttachments && (
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
            disabled={value === "" || isGenerating}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>

      {allowAttachments && <FileUploadOverlay isDragging={isDragging} />}
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

// File upload overlay component
function FileUploadOverlay({ isDragging }: { isDragging: boolean }) {
  if (!isDragging) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80 backdrop-blur"
    >
      <div className="flex flex-col items-center justify-center space-y-2 p-4 text-center">
        <Paperclip className="h-8 w-8 text-primary" />
        <p className="text-lg font-medium">Drop files to attach</p>
        <p className="text-sm text-muted-foreground">
          Supports images, PDFs, and text files
        </p>
      </div>
    </motion.div>
  );
} 