import { Skeleton } from "@/components/ui/skeleton";

interface ImageGallerySkeletonProps {
  count?: number;
}

export function ImageGallerySkeleton({ count = 8 }: ImageGallerySkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }, (_, index) => (
        <div 
          key={index} 
          className="overflow-hidden rounded-xl border border-muted/40 bg-gradient-to-br from-card/80 to-muted/30 shadow-sm"
        >
          <div className="aspect-square relative overflow-hidden p-2">
            <Skeleton className="w-full h-full rounded-lg absolute inset-0" />
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 