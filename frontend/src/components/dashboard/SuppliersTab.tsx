import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Supplier {
    supplier_id: number;
    name: string;
    contact_email: string;
    phone: string;
}

export default function SuppliersTab() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({ id: 0, name: '', contact_email: '', phone: '' });
    const { toast } = useToast();

    const loadSuppliers = async () => {
        try {
            setIsLoading(true);
            const data = await fetchWithAuth('/suppliers');
            setSuppliers(data);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadSuppliers(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await fetchWithAuth(`/suppliers/${formData.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                toast({ title: 'Success', description: 'Supplier updated.' });
            } else {
                await fetchWithAuth('/suppliers', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                toast({ title: 'Success', description: 'Supplier created.' });
            }
            setIsOpen(false);
            loadSuppliers();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this supplier?')) return;
        try {
            await fetchWithAuth(`/suppliers/${id}`, { method: 'DELETE' });
            toast({ title: 'Success', description: 'Supplier deleted.' });
            loadSuppliers();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const openEdit = (supplier: Supplier) => {
        setFormData({ id: supplier.supplier_id, name: supplier.name, contact_email: supplier.contact_email || '', phone: supplier.phone || '' });
        setIsOpen(true);
    };

    const openCreate = () => {
        setFormData({ id: 0, name: '', contact_email: '', phone: '' });
        setIsOpen(true);
    };

    if (isLoading) return <div>Loading Suppliers...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Suppliers Management</h2>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreate}>Add Supplier</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{formData.id ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <Button type="submit" className="w-full">Save Supplier</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {suppliers.map(s => (
                        <TableRow key={s.supplier_id}>
                            <TableCell>{s.supplier_id}</TableCell>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>{s.contact_email}</TableCell>
                            <TableCell>{s.phone}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(s.supplier_id)}>Delete</Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {suppliers.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center">No suppliers found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
