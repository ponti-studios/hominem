import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ponti-studios/ui/overlays';
import { Button } from '@ponti-studios/ui/primitives';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ponti-studios/ui/primitives';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ExportTransactions } from '~/components/finance/export-transactions';
import { useFinanceApiClient } from '~/lib/api/provider';
import { authClient } from '~/lib/auth-client';
import { useUser } from '~/lib/hooks/use-user';
import { toast } from '~/lib/toast';

export default function AccountPage() {
  const logout = () => authClient.signOut();
  const user = useUser();
  useFinanceApiClient(); // unused, but throws if we're not inside FinanceHonoProvider - cheap sanity check
  const queryClient = useQueryClient();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const deleteAllFinanceData = useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/finance', { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
      toast({
        title: 'Data Deleted',
        description: 'All your finance data has been successfully deleted.',
      });
      setShowConfirmDelete(false);
    },
    onError: (error: Error) => {
      console.error('Error deleting finance data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Delete failed. Retry.',
        variant: 'destructive',
      });
      setShowConfirmDelete(false);
    },
  });

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Finance Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your financial data, export transactions, and other account settings.
        </p>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>Your Hominem sign-in information.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="mt-1 truncate font-medium text-foreground">
                  {user?.name || 'Name not provided'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="mt-1 truncate font-medium text-foreground">
                  {user?.email || 'Email unavailable'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export your transaction data.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExportTransactions />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
            <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-destructive/50 bg-destructive/5">
              <div>
                <h3 className="text-md font-semibold text-destructive">Delete All Finance Data</h3>
                <p className="text-sm text-destructive/80">
                  Permanently remove all your accounts, transactions, and budget information.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowConfirmDelete(true)}
                disabled={deleteAllFinanceData.isPending}
              >
                {deleteAllFinanceData.isPending ? 'Deleting...' : 'Delete All Data'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="destructive" onClick={() => logout()}>
            Sign Out
          </Button>
        </div>
      </div>

      <Dialog alert open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete all your finance data from
              our servers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={deleteAllFinanceData.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteAllFinanceData.mutate()}
                disabled={deleteAllFinanceData.isPending}
              >
                {deleteAllFinanceData.isPending ? 'Deleting...' : 'Yes, delete all data'}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
