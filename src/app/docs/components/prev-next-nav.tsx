        // src/app/docs/components/prev-next-nav.tsx
        import Link from 'next/link';
        import { ArrowLeft, ArrowRight } from 'lucide-react';

        interface PageLink {
          path: string;
          title: string;
        }

        interface PrevNextNavProps {
          prev: PageLink | null;
          next: PageLink | null;
        }

        export function PrevNextNav({ prev, next }: PrevNextNavProps) {
          if (!prev && !next) {
            return null; // Don't render anything if neither link exists
          }

          return (
            <nav className="mt-12 flex flex-col items-center gap-4 border-t pt-8 sm:flex-row sm:justify-between">
              {prev ? (
                <Link 
                  href={{ pathname: prev.path }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <div className="flex flex-col text-left">
                     <span>Previous</span>
                     <span className='text-primary'>{prev.title}</span>
                  </div>
                </Link>
              ) : (
                <div /> // Empty div to maintain spacing with justify-between
              )}
              {next ? (
                <Link 
                  href={{ pathname: next.path }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
                >
                  <div className="flex flex-col text-right">
                     <span>Next</span>
                     <span className='text-primary'>{next.title}</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <div /> // Empty div to maintain spacing
              )}
            </nav>
          );
        }