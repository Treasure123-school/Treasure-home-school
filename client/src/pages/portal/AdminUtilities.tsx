
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, CheckCircle, XCircle } from "lucide-react";

export default function AdminUtilities() {
  const { user } = useAuth();
  const { toast } = useToast();

  const deleteDemoAccountsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/delete-demo-accounts');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Demo Accounts Deleted",
        description: `Successfully deleted ${data.deletedUsers?.length || 0} demo accounts: ${data.deletedUsers?.join(', ')}`,
        className: "border-green-500 bg-green-50",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete demo accounts",
        variant: "destructive",
        className: "border-red-500 bg-red-50",
      });
    },
  });

  if (!user) {
    return <div>Please log in to access admin utilities.</div>;
  }
  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Utilities</h1>
          <p className="text-muted-foreground mt-1">
            System maintenance and cleanup tools
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Demo Accounts
            </CardTitle>
            <CardDescription>
              Remove the following demo accounts from the system:
              <ul className="list-disc list-inside mt-2">
                <li>admin@demo.com</li>
                <li>teacher@demo.com</li>
                <li>admin@treasure.com</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive"
              onClick={() => deleteDemoAccountsMutation.mutate()}
              disabled={deleteDemoAccountsMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteDemoAccountsMutation.isPending ? 'Deleting...' : 'Delete Demo Accounts'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
