import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4" data-testid="page-not-found">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-3" data-testid="text-404-headline">
            Page Not Found
          </h1>

          <p className="text-muted-foreground mb-2" data-testid="text-404-explanation">
            The page you're looking for might have been moved or no longer exists.
          </p>

          <p className="text-sm text-muted-foreground mb-6" data-testid="text-404-instruction">
            Please check the URL or return to the homepage to find what you need.
          </p>

          <Link href="/">
            <Button className="gap-2" data-testid="button-go-home">
              <Home className="h-4 w-4" />
              Go to Homepage
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
