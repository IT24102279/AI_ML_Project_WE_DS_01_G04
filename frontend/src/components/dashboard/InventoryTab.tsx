import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Product {
    product_id: number;
    name: string;
    measure_unit: string;
    category: string;
    reorder_threshold: number;
}

interface AlertData {
    lowStock: any[];
    nearExpiry: any[];
}

export default function InventoryTab() {
    const [products, setProducts] = useState<Product[]>([]);
    const [alerts, setAlerts] = useState<AlertData>({ lowStock: [], nearExpiry: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({ id: 0, name: '', measure_unit: '', category: '', reorder_threshold: 0 });
    const { toast } = useToast();

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [prodData, alertData] = await Promise.all([
                fetchWithAuth('/products'),
                fetchWithAuth('/inventory/alerts')
            ]);
            setProducts(prodData);
            setAlerts(alertData);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...formData, reorder_threshold: Number(formData.reorder_threshold) };
            if (formData.id) {
                await fetchWithAuth(`/products/${formData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Product updated.' });
            } else {
                await fetchWithAuth('/products', { method: 'POST', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Product created.' });
            }
            setIsOpen(false);
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await fetchWithAuth(`/products/${id}`, { method: 'DELETE' });
            toast({ title: 'Success', description: 'Product deleted.' });
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    if (isLoading) return <div>Loading Inventory...</div>;

    return (
        <div className="space-y-8">
            {/* Alerts Section */}
            {(alerts.lowStock.length > 0 || alerts.nearExpiry.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alerts.lowStock.length > 0 && (
                        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                            <h3 className="text-red-800 font-bold mb-2">Low Stock Alerts</h3>
                            <ul className="list-disc pl-5 text-red-700 text-sm">
                                {alerts.lowStock.map((a: any) => (
                                    <li key={a.product_id}>{a.name} (Stock: {a.current_stock_level} / Min: {a.reorder_threshold})</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {alerts.nearExpiry.length > 0 && (
                        <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                            <h3 className="text-amber-800 font-bold mb-2">Near Expiry Alerts</h3>
                            <ul className="list-disc pl-5 text-amber-700 text-sm">
                                {alerts.nearExpiry.map((a: any) => (
                                    <li key={a.batch_id}>{a.name} - Batch {a.batch_number} (Expires: {new Date(a.expiry_date).toLocaleDateString()})</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Products Data Table */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Products Catalog</h2>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { setFormData({ id: 0, name: '', measure_unit: '', category: '', reorder_threshold: 0 }); setIsOpen(true); }}>
                                Add Product
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{formData.id ? 'Edit Product' : 'New Product'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Measure Unit (e.g., Tablets, Bottles)</Label>
                                    <Input required value={formData.measure_unit} onChange={e => setFormData({ ...formData, measure_unit: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Reorder Threshold</Label>
                                    <Input type="number" required value={formData.reorder_threshold} onChange={e => setFormData({ ...formData, reorder_threshold: e.target.value as any })} />
                                </div>
                                <Button type="submit" className="w-full">Save Product</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Min Stock</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map(p => (
                            <TableRow key={p.product_id}>
                                <TableCell>{p.product_id}</TableCell>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell>{p.measure_unit}</TableCell>
                                <TableCell>{p.category}</TableCell>
                                <TableCell>{p.reorder_threshold}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => { setFormData({ id: p.product_id, name: p.name, measure_unit: p.measure_unit, category: p.category || '', reorder_threshold: p.reorder_threshold }); setIsOpen(true); }}>Edit</Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(p.product_id)}>Delete</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {products.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No products found.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
