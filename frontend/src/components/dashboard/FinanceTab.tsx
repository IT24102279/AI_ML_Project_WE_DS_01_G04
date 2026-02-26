import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function FinanceTab({
    currency = '$',
    onCurrencyChange
}: {
    currency?: string;
    onCurrencyChange?: (val: string) => void
}) {
    const [checks, setChecks] = useState<PendingCheck[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [localCurrency, setLocalCurrency] = useState(currency);
    const { toast } = useToast();

    // Sync local state when prop changes
    useEffect(() => {
        setLocalCurrency(currency);
    }, [currency]);

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

    const handleSaveCurrency = async () => {
        try {
            await fetchWithAuth('/settings/currency', {
                method: 'PUT',
                body: JSON.stringify({ value: localCurrency })
            });
            if (onCurrencyChange) onCurrencyChange(localCurrency);
            toast({ title: 'Saved', description: 'Application currency updated successfully.' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    if (isLoading) return <div>Loading Finance Data...</div>;

    return (
        <div className="space-y-8">
            {/* Global Settings Section integrated into Finance Tab */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-lg">Application Settings</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="max-w-md space-y-2">
                        <Label>Base Currency Symbol</Label>
                        <div className="flex space-x-2">
                            <Input
                                value={localCurrency}
                                onChange={e => setLocalCurrency(e.target.value)}
                                placeholder="e.g. $, LKR, €, £"
                            />
                            <Button onClick={handleSaveCurrency}>Save</Button>
                        </div>
                        <p className="text-xs text-slate-500">Changes the currency sign across all application modules.</p>
                    </div>
                </CardContent>
            </Card>

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
                                    <TableCell>{currency} {Number(c.total_amount).toFixed(2)}</TableCell>
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
        </div>
    );
}
