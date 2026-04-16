import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Product {
    product_id: number;
    name: string;
    measure_unit: string;
    category: string;
    reorder_threshold: number;
    current_stock: number;
    selling_price: number;
}

interface Batch {
    batch_id: number;
    product_id: number;
    batch_number: string;
    expiry_date: string;
    location: string;
    purchased_quantity: number;
    bonus_quantity: number;
    unit_cost: number;
    current_stock_level: number;
    product_name: string;
}

interface AlertData {
    lowStock: any[];
    nearExpiry: any[];
}

export default function InventoryTab({ currency = '$' }: { currency?: string }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [alerts, setAlerts] = useState<AlertData>({ lowStock: [], nearExpiry: [] });
    const [isLoading, setIsLoading] = useState(true);

    // Product Form State
    const [isProductOpen, setIsProductOpen] = useState(false);
    const [productForm, setProductForm] = useState({ id: 0, name: '', measure_unit: '', category: '', reorder_threshold: 0, current_stock: 0, selling_price: 0 });

    // Batch Form State
    const [isBatchOpen, setIsBatchOpen] = useState(false);
    const [batchForm, setBatchForm] = useState({ id: 0, product_id: 0, batch_number: '', expiry_date: '', location: '', purchased_quantity: 0, bonus_quantity: 0, unit_cost: 0, current_stock_level: 0 });

    const { toast } = useToast();

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [prodData, alertData, batchData] = await Promise.all([
                fetchWithAuth('/products'),
                fetchWithAuth('/inventory/alerts'),
                fetchWithAuth('/inventory/batches')
            ]);
            setProducts(prodData);
            setAlerts(alertData);
            setBatches(batchData);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- Product Handlers ---
    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...productForm,
                reorder_threshold: Number(productForm.reorder_threshold),
                current_stock: Number(productForm.current_stock),
                selling_price: Number(productForm.selling_price)
            };
            if (productForm.id) {
                await fetchWithAuth(`/products/${productForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Product updated.' });
            } else {
                await fetchWithAuth('/products', { method: 'POST', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Product created.' });
            }
            setIsProductOpen(false);
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleProductDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await fetchWithAuth(`/products/${id}`, { method: 'DELETE' });
            toast({ title: 'Success', description: 'Product deleted.' });
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    // --- Batch Handlers ---
    const handleBatchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...batchForm,
                product_id: Number(batchForm.product_id),
                purchased_quantity: Number(batchForm.purchased_quantity),
                bonus_quantity: Number(batchForm.bonus_quantity),
                unit_cost: Number(batchForm.unit_cost),
                current_stock_level: Number(batchForm.current_stock_level)
            };
            if (batchForm.id) {
                await fetchWithAuth(`/inventory/batches/${batchForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Batch updated.' });
            } else {
                await fetchWithAuth('/inventory/batches', { method: 'POST', body: JSON.stringify(payload) });
                toast({ title: 'Success', description: 'Batch created.' });
            }
            setIsBatchOpen(false);
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleBatchDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this batch?')) return;
        try {
            await fetchWithAuth(`/inventory/batches/${id}`, { method: 'DELETE' });
            toast({ title: 'Success', description: 'Batch deleted.' });
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

            <Tabs defaultValue="products">
                <TabsList className="mb-4">
                    <TabsTrigger value="products">Products Master</TabsTrigger>
                    <TabsTrigger value="batches">Stock Batches</TabsTrigger>
                </TabsList>

                {/* --- PRODUCTS TAB --- */}
                <TabsContent value="products" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Products Catalog</h2>
                        <Dialog open={isProductOpen} onOpenChange={setIsProductOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => { setProductForm({ id: 0, name: '', measure_unit: '', category: '', reorder_threshold: 0, current_stock: 0, selling_price: 0 }); setIsProductOpen(true); }}>
                                    Add Product
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{productForm.id ? 'Edit Product' : 'New Product'}</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleProductSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Measure Unit (e.g., Tablets, Bottles)</Label>
                                        <Input required value={productForm.measure_unit} onChange={e => setProductForm({ ...productForm, measure_unit: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Input value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-500">Current Stock (Automated)</Label>
                                        <Input 
                                            type="number" 
                                            disabled 
                                            value={productForm.current_stock} 
                                            className="bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed italic"
                                        />
                                        <p className="text-[11px] text-amber-600 font-semibold bg-amber-50 p-2 rounded border border-amber-100">
                                            ⚠️ Current stock cannot be set manually. Use the <strong>Stock Batches</strong> tab or <strong>Receive Stock (GRN)</strong> to add inventory.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Unit Selling Price ({currency})</Label>
                                        <Input type="number" min="0" step="0.01" required value={productForm.selling_price} onChange={e => setProductForm({ ...productForm, selling_price: e.target.value as any })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Reorder Threshold</Label>
                                        <Input type="number" min="0" required value={productForm.reorder_threshold} onChange={e => setProductForm({ ...productForm, reorder_threshold: e.target.value as any })} />
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
                                <TableHead>Current Stock</TableHead>
                                <TableHead>Base Price</TableHead>
                                <TableHead>Min Stock</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map(p => (
                                <TableRow key={p.product_id} className={p.current_stock <= p.reorder_threshold ? "bg-red-50" : ""}>
                                    <TableCell>{p.product_id}</TableCell>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell>{p.measure_unit}</TableCell>
                                    <TableCell>{p.category}</TableCell>
                                    <TableCell className="font-bold text-lg text-blue-800">{p.current_stock}</TableCell>
                                    <TableCell>{currency}{Number(p.selling_price || 0).toFixed(2)}</TableCell>
                                    <TableCell>{p.reorder_threshold}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => { setProductForm({ id: p.product_id, name: p.name, measure_unit: p.measure_unit, category: p.category || '', reorder_threshold: p.reorder_threshold, current_stock: p.current_stock, selling_price: p.selling_price || 0 }); setIsProductOpen(true); }}>Edit</Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleProductDelete(p.product_id)}>Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {products.length === 0 && <TableRow><TableCell colSpan={8} className="text-center">No products found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </TabsContent>

                {/* --- BATCHES TAB --- */}
                <TabsContent value="batches" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Stock Batches</h2>
                        <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => { setBatchForm({ id: 0, product_id: products[0]?.product_id || 0, batch_number: '', expiry_date: '', location: '', purchased_quantity: 0, bonus_quantity: 0, unit_cost: 0, current_stock_level: 0 }); setIsBatchOpen(true); }}>
                                    Add Batch Manually
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>{batchForm.id ? 'Edit Batch' : 'New Batch'}</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleBatchSubmit} className="space-y-3">
                                    {!batchForm.id && (
                                        <div className="space-y-1">
                                            <Label>Product</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={batchForm.product_id}
                                                onChange={e => setBatchForm({ ...batchForm, product_id: Number(e.target.value) })}
                                                required
                                            >
                                                <option value="" disabled>Select Product</option>
                                                {products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <Label>Batch Number</Label>
                                        <Input required value={batchForm.batch_number} onChange={e => setBatchForm({ ...batchForm, batch_number: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Expiry Date (YYYY-MM-DD)</Label>
                                        <Input required type="date" min={new Date().toISOString().split("T")[0]} value={batchForm.expiry_date} onChange={e => setBatchForm({ ...batchForm, expiry_date: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Location</Label>
                                        <Input value={batchForm.location} onChange={e => setBatchForm({ ...batchForm, location: e.target.value })} />
                                    </div>
                                    {!batchForm.id ? (
                                        <>
                                            <div className="space-y-1">
                                                <Label>Purchased Quantity</Label>
                                                <Input type="number" min="0" required value={batchForm.purchased_quantity} onChange={e => setBatchForm({ ...batchForm, purchased_quantity: e.target.value as any })} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Bonus Quantity</Label>
                                                <Input type="number" min="0" value={batchForm.bonus_quantity} onChange={e => setBatchForm({ ...batchForm, bonus_quantity: e.target.value as any })} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-1">
                                            <Label>Current Stock Level</Label>
                                            <Input type="number" min="0" required value={batchForm.current_stock_level} onChange={e => setBatchForm({ ...batchForm, current_stock_level: e.target.value as any })} />
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <Label>Unit Cost ({currency})</Label>
                                        <Input type="number" min="0" step="0.01" required value={batchForm.unit_cost} onChange={e => setBatchForm({ ...batchForm, unit_cost: e.target.value as any })} />
                                    </div>

                                    <Button type="submit" className="w-full mt-2">Save Batch</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Batch Number</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Current Stock</TableHead>
                                <TableHead>Unit Cost</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batches.map(b => (
                                <TableRow key={b.batch_id} className={new Date(b.expiry_date) < new Date() ? "bg-red-50 text-red-900" : ""}>
                                    <TableCell className="font-medium">{b.batch_number}</TableCell>
                                    <TableCell>{b.product_name}</TableCell>
                                    <TableCell>{new Date(b.expiry_date).toLocaleDateString()}</TableCell>
                                    <TableCell>{b.location}</TableCell>
                                    <TableCell className="font-bold">{b.current_stock_level}</TableCell>
                                    <TableCell>{currency}{Number(b.unit_cost || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => {
                                            // Handle timezone offsets issues by mapping properly
                                            const expDateStr = new Date(b.expiry_date).toISOString().split('T')[0];
                                            setBatchForm({
                                                id: b.batch_id,
                                                product_id: b.product_id,
                                                batch_number: b.batch_number,
                                                expiry_date: expDateStr,
                                                location: b.location || '',
                                                purchased_quantity: b.purchased_quantity,
                                                bonus_quantity: b.bonus_quantity,
                                                unit_cost: b.unit_cost,
                                                current_stock_level: b.current_stock_level
                                            });
                                            setIsBatchOpen(true);
                                        }}>Edit</Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleBatchDelete(b.batch_id)}>Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {batches.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No batches found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        </div>
    );
}
