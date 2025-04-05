import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export default function CategoryNotFound() {
  return (
    <div className="container flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl font-bold mb-3">Category Not Found</h1>
      <p className="text-muted-foreground text-lg mb-8">
        The agent category you&apos;re looking for doesn&apos;t exist
      </p>
      <Link href="/agents">
        <Button variant="default" className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to All Agents
        </Button>
      </Link>
    </div>
  )
} 