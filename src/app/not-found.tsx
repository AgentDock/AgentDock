import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-2xl font-bold">Page Not Found</h2>
      <p className="text-muted-foreground">Could not find the requested page</p>
      <Link 
        href="/"
        className="text-primary hover:underline"
      >
        Return Home
      </Link>
    </div>
  );
} 