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
            <nav className="mt-12 flex w-full items-center justify-between gap-4 border-t border-border pt-8">
              {prev ? (
                <Link 
                  href={{ pathname: prev.path }}
                  className="inline-flex flex-1 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4 flex-shrink-0" />
                  <div className="flex flex-col text-left overflow-hidden">
                     <span className="text-xs">Previous</span>
                     <span className='truncate text-primary font-semibold'>{prev.title}</span>
                  </div>
                </Link>
              ) : (
                <div className="flex-1"></div>
              )}
              {next ? (
                <Link 
                  href={{ pathname: next.path }}
                  className="inline-flex flex-1 items-center justify-end gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
                >
                  <div className="flex flex-col text-right overflow-hidden">
                     <span className="text-xs">Next</span>
                     <span className='truncate text-primary font-semibold'>{next.title}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0" />
                </Link>
              ) : (
                <div className="flex-1"></div>
              )}
            </nav>
          );
        }