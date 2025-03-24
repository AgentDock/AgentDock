"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload as UploadIcon, Image as ImageIcon, X, Sparkles } from "lucide-react";

interface ImageUploadProps {
  onImageSelect: (imageData: string) => void;
  currentImage: string | null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
}

export function ImageUpload({ onImageSelect, currentImage }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Update the selected file when the current image changes
  useEffect(() => {
    if (!currentImage) {
      setSelectedFile(null);
    }
  }, [currentImage]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setSelectedFile(file);

      // Convert the file to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          const result = event.target.result as string;
          console.log("Image loaded, length:", result.length);
          onImageSelect(result);
        }
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"]
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  });

  const handleRemove = () => {
    setSelectedFile(null);
    onImageSelect("");
  };

  return (
    <div className="w-full">
      {!currentImage ? (
        <div
          {...getRootProps()}
          className={`
            min-h-[220px] p-6 rounded-xl 
            flex flex-col items-center justify-center gap-4
            bg-gradient-to-br from-primary/5 via-primary/10 to-accent/20
            shadow-inner shadow-primary/10
            border-2 ${isDragActive ? "border-primary/50 border-dashed" : "border-transparent"} 
            transition-all duration-200 ease-in-out hover:shadow-lg hover:shadow-primary/10
            cursor-pointer relative overflow-hidden
            before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] before:bg-[length:20px_20px] before:opacity-20
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center mb-4 shadow-lg shadow-primary/5">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary/90 mb-1">
              Upload an Image
            </h3>
            <p className="text-base font-medium text-foreground mb-1">
              Drop your file here or click to browse
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Edit existing images or create new ones with text prompts
            </p>
            <div className="mt-4 flex gap-2">
              <div className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full">PNG</div>
              <div className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full">JPG</div>
              <div className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full">Max 10MB</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden shadow-lg bg-gradient-to-b from-card to-card/80">
          <div className="flex items-center justify-between p-3 border-b bg-card">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
                <ImageIcon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium truncate">
                  {selectedFile?.name || "Image Ready for Editing"}
                </p>
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4 mr-1" />
              <span className="text-xs font-medium">Remove</span>
            </Button>
          </div>
          <div className="aspect-[16/9] relative">
            <img
              src={currentImage}
              alt="Selected"
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
} 