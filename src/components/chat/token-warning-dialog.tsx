import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Export the type so it can be imported
export interface TokenWarning {
  title: string;
  points: string[];
}

interface TokenWarningDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tokenWarning: TokenWarning | null;
}

export function TokenWarningDialog({ 
  isOpen, 
  onOpenChange, 
  tokenWarning 
}: TokenWarningDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tokenWarning?.title || 'Token Usage Warning'}</DialogTitle>
          <DialogDescription>
            Important notice regarding the token consumption for this chat session.
          </DialogDescription>
        </DialogHeader>
        {/* Render structured warning if available */}
        {tokenWarning && (
          <div className="text-sm text-muted-foreground space-y-2 pt-2">
            <p className="font-medium text-foreground">{tokenWarning.title}</p>
            <ul className="space-y-1 list-disc list-outside pl-5">
              {tokenWarning.points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Okay</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
