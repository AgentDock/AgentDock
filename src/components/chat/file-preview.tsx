'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileIcon, FileText, X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
}

// File type helpers
const isImage = (file: File) => file.type.startsWith('image/');
const isPDF = (file: File) => file.type === 'application/pdf';
const isText = (file: File) =>
  file.type.startsWith('text/') ||
  file.name.endsWith('.txt') ||
  file.name.endsWith('.md') ||
  file.name.endsWith('.json') ||
  file.name.endsWith('.csv');
const isCode = (file: File) =>
  file.name.endsWith('.js') ||
  file.name.endsWith('.ts') ||
  file.name.endsWith('.jsx') ||
  file.name.endsWith('.tsx') ||
  file.name.endsWith('.py') ||
  file.name.endsWith('.rb') ||
  file.name.endsWith('.java') ||
  file.name.endsWith('.go');

// Size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const FilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  (props, ref) => {
    // Check file size
    if (props.file.size > MAX_FILE_SIZE) {
      return (
        <ErrorFilePreview
          {...props}
          ref={ref}
          error="File too large (max 10MB)"
        />
      );
    }

    if (isImage(props.file)) {
      return (
        <ImageFilePreview
          {...props}
          ref={ref}
        />
      );
    }

    if (isPDF(props.file)) {
      return (
        <PDFFilePreview
          {...props}
          ref={ref}
        />
      );
    }

    if (isText(props.file)) {
      return (
        <TextFilePreview
          {...props}
          ref={ref}
        />
      );
    }

    if (isCode(props.file)) {
      return (
        <CodeFilePreview
          {...props}
          ref={ref}
        />
      );
    }

    return (
      <GenericFilePreview
        {...props}
        ref={ref}
      />
    );
  }
);
FilePreview.displayName = 'FilePreview';

const BaseFilePreview = React.forwardRef<
  HTMLDivElement,
  FilePreviewProps & { children: React.ReactNode; className?: string }
>(({ file, onRemove, children, className }, ref) => {
  return (
    <motion.div
      ref={ref}
      className={cn(
        'relative flex max-w-[200px] rounded-md border p-1.5 pr-2 text-xs',
        className
      )}
      layout
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      aria-label={`${getFileTypeName(file)} attachment: ${file.name}`}
    >
      <div className="flex w-full items-center space-x-2">
        {children}
        {/* Remove filename display - keep this commented line for reference */}
        {/* <span className="w-full truncate text-muted-foreground">
          {file.name}
        </span> */}
      </div>

      {onRemove ? (
        <button
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-offset-1"
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name} attachment`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </motion.div>
  );
});
BaseFilePreview.displayName = 'BaseFilePreview';

// Function to get human-readable file type name
function getFileTypeName(file: File): string {
  if (isImage(file)) return 'Image';
  if (isPDF(file)) return 'PDF';
  if (isText(file)) return 'Text';
  if (isCode(file)) return 'Code';
  return 'File';
}

const ImageFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  (props, ref) => {
    return (
      <BaseFilePreview
        {...props}
        ref={ref}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`Attachment preview: ${props.file.name}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border bg-muted object-cover"
          src={URL.createObjectURL(props.file)}
        />
      </BaseFilePreview>
    );
  }
);
ImageFilePreview.displayName = 'ImageFilePreview';

const PDFFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  (props, ref) => {
    return (
      <BaseFilePreview
        {...props}
        ref={ref}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border bg-muted">
          <FileText className="h-6 w-6 text-red-500" />
        </div>
      </BaseFilePreview>
    );
  }
);
PDFFilePreview.displayName = 'PDFFilePreview';

const TextFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  ({ file, ...props }, ref) => {
    const [preview, setPreview] = React.useState<string>('');

    useEffect(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setPreview(text.slice(0, 50) + (text.length > 50 ? '...' : ''));
      };
      reader.readAsText(file);
    }, [file]);

    return (
      <BaseFilePreview
        file={file}
        {...props}
        ref={ref}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border bg-muted">
          <div className="h-full w-full overflow-hidden p-0.5 text-[6px] leading-none text-muted-foreground">
            {preview || 'Loading...'}
          </div>
        </div>
      </BaseFilePreview>
    );
  }
);
TextFilePreview.displayName = 'TextFilePreview';

const CodeFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  (props, ref) => {
    return (
      <BaseFilePreview
        {...props}
        ref={ref}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border bg-muted">
          <FileText className="h-6 w-6 text-blue-500" />
        </div>
      </BaseFilePreview>
    );
  }
);
CodeFilePreview.displayName = 'CodeFilePreview';

const GenericFilePreview = React.forwardRef<HTMLDivElement, FilePreviewProps>(
  (props, ref) => {
    return (
      <BaseFilePreview
        {...props}
        ref={ref}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border bg-muted">
          <FileIcon className="h-6 w-6 text-foreground" />
        </div>
      </BaseFilePreview>
    );
  }
);
GenericFilePreview.displayName = 'GenericFilePreview';

const ErrorFilePreview = React.forwardRef<
  HTMLDivElement,
  FilePreviewProps & { error: string }
>((props, ref) => {
  return (
    <BaseFilePreview
      {...props}
      ref={ref}
      className="border-destructive"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-destructive bg-destructive/10">
        <FileIcon className="h-6 w-6 text-destructive" />
      </div>
    </BaseFilePreview>
  );
});
ErrorFilePreview.displayName = 'ErrorFilePreview';
