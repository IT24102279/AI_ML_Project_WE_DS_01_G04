import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface PendingCheck {
    invoice_id: number;
    supplier_id: number;
    supplier_name: string;
    supplier_invoice_number: string;
    total_amount: string;
    check_number: string;
    check_date: string;
    check_cleared: number;
    received_at: string;
}

export default function FinanceTab() {
    const [checks, setChecks] = useState<PendingCheck[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const loadChecks = async () => {
        try {
            setIsLoading(true);
            const data = await fetchWithAuth('/finance/pending-checks');
            setChecks(data);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadChecks(); }, []);

    const handleClearCheck = async (id: number) => {
        if (!confirm('Mark this check as cleared?')) return;
        try {
            await fetchWithAuth(`/finance/checks/${id}/clear`, { method: 'PATCH' });
            toast({ title: 'Success', description: 'Check marked as cleared.' });
            loadChecks(); // Refresh list
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    if (isLoading) return <div>Loading Finance Data...</div>;

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold">Post-Dated Checks Tracker</h2>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Check Number</TableHead>
                        <TableHead>Check Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {checks.map(c => {
                        const isOverdue = new Date(c.check_date) < new Date();
                        return (
                            <TableRow key={c.invoice_id}>
                                <TableCell className="font-medium">{c.supplier_invoice_number}</TableCell>
                                <TableCell>{c.supplier_name}</TableCell>
                                <TableCell>${Number(c.total_amount).toFixed(2)}</TableCell>
                                <TableCell>{c.check_number}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {new Date(c.check_date).toLocaleDateString()}
                                        {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50">Pending</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleClearCheck(c.invoice_id)}>
                                        Mark Cleared
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {checks.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                No pending checks found. You're all caught up!
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
