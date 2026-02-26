import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Supplier { supplier_id: number; name: string; }
interface ProductSearchResult { product_id: number; name: string; measure_unit: string; }

interface BatchRow {
    id: string;
    product_id: number | null;
    product_name: string;
    batch_number: string;
    expiry_date: string;
    location: string;
    purchased_quantity: number;
    bonus_quantity: number;
    unit_cost: number;
}

export default function GRNTab({ currency = '$' }: { currency?: string }) {
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [supplierId, setSupplierId] = useState<string>("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Check">("Cash");
    const [checkNumber, setCheckNumber] = useState("");
    const [checkDate, setCheckDate] = useState("");

    const [batches, setBatches] = useState<BatchRow[]>([]);

    const [openSupplierBox, setOpenSupplierBox] = useState(false);
    const [openProductBox, setOpenProductBox] = useState<string | null>(null);

    // Live Search specific state per row
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
    const [searchResults, setSearchResults] = useState<Record<string, ProductSearchResult[]>>({});

    const [activeTab, setActiveTab] = useState("new");
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const loadHistory = async () => {
        try {
            setIsLoadingHistory(true);
            const data = await fetchWithAuth('/inventory/grn-history');
            setHistory(data);
        } catch (error: any) {
            toast({ title: 'Error loading history', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (activeTab === "history") {
            loadHistory();
        }
    }, [activeTab]);

    useEffect(() => {
        const loadSuppliers = async () => {
            try {
                const data = await fetchWithAuth('/suppliers');
                setSuppliers(data);
            } catch (err) { }
        };
        loadSuppliers();
    }, []);

    const addRow = () => {
        setBatches([...batches, {
            id: crypto.randomUUID(), product_id: null, product_name: "", batch_number: "",
            expiry_date: "", location: "", purchased_quantity: 0, bonus_quantity: 0, unit_cost: 0
        }]);
    };

    const removeRow = (id: string) => {
        setBatches(batches.filter(b => b.id !== id));
    };

    const updateRow = (id: string, field: keyof BatchRow, value: any) => {
        setBatches(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const handleProductSearch = async (rowId: string, q: string) => {
        setSearchQueries(prev => ({ ...prev, [rowId]: q }));
        if (q.length < 2) {
            setSearchResults(prev => ({ ...prev, [rowId]: [] }));
            return;
        }
        try {
            const results = await fetchWithAuth(`/products/search?q=${encodeURIComponent(q)}`);
            setSearchResults(prev => ({ ...prev, [rowId]: results }));
        } catch (error) { }
    };

    const selectProduct = (rowId: string, product: ProductSearchResult) => {
        updateRow(rowId, "product_id", product.product_id);
        updateRow(rowId, "product_name", `${product.name} (${product.measure_unit})`);
        setSearchQueries(prev => ({ ...prev, [rowId]: "" })); // Clear search
    };

    const totalAmount = batches.reduce((sum, b) => sum + (Number(b.purchased_quantity) * Number(b.unit_cost)), 0);

    const handleSubmit = async () => {
        if (!supplierId || !invoiceNumber || batches.length === 0) {
            toast({ title: "Validation Error", description: "Supplier, Invoice #, and at least one row are required.", variant: "destructive" });
            return;
        }

        const invalidRow = batches.find(b => !b.product_id || !b.batch_number || !b.expiry_date || b.purchased_quantity <= 0 || b.unit_cost <= 0);
        if (invalidRow) {
            toast({ title: "Validation Error", description: "All rows must have a product, batch #, valid expiry, qty > 0, and cost > 0.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                supplier_id: Number(supplierId),
                supplier_invoice_number: invoiceNumber,
                payment_method: paymentMethod,
                check_number: paymentMethod === 'Check' ? checkNumber : null,
                check_date: paymentMethod === 'Check' ? checkDate : null,
                batches: batches.map(b => ({
                    product_id: b.product_id,
                    batch_number: b.batch_number,
                    expiry_date: b.expiry_date,
                    location: b.location,
                    purchased_quantity: Number(b.purchased_quantity),
                    bonus_quantity: Number(b.bonus_quantity),
                    unit_cost: Number(b.unit_cost)
                }))
            };

            const res = await fetchWithAuth('/inventory/receive', { method: 'POST', body: JSON.stringify(payload) });
            toast({ title: "GRN Posted", description: `Invoice total ${currency}${res.total_amount.toFixed(2)} recorded.` });

            // Reset
            setSupplierId(""); setInvoiceNumber(""); setPaymentMethod("Cash"); setCheckNumber(""); setCheckDate(""); setBatches([]);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Goods Received Notes (GRN)</h2>
                {activeTab === "new" && (
                    <div className="text-xl font-bold p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-200">
                        Grand Total: {currency}{totalAmount.toFixed(2)}
                    </div>
                )}
            </div>

            <TabsList>
                <TabsTrigger value="new">Receive New Stock</TabsTrigger>
                <TabsTrigger value="history">GRN History</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-4">
                <Card className="shadow-sm">
                    <CardHeader className="bg-slate-50 border-b">
                        <CardTitle className="text-lg">Past Invoices</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>GRN / Invoice #</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Received Date</TableHead>
                                    <TableHead>Total Amount</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Recorded By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingHistory ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">Loading history...</TableCell>
                                    </TableRow>
                                ) : history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">No GRN history found.</TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((inv) => (
                                        <TableRow key={inv.invoice_id}>
                                            <TableCell className="font-medium">{inv.supplier_invoice_number}</TableCell>
                                            <TableCell>{inv.supplier_name}</TableCell>
                                            <TableCell>{new Date(inv.received_at).toLocaleString()}</TableCell>
                                            <TableCell>{currency}{Number(inv.total_amount).toFixed(2)}</TableCell>
                                            <TableCell>
                                                {inv.payment_method}
                                                {inv.payment_method === 'Check' && <span className="text-xs text-slate-500 block">#{inv.check_number}</span>}
                                            </TableCell>
                                            <TableCell>
                                                {inv.payment_method === 'Cash'
                                                    ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Paid In Full</Badge>
                                                    : inv.check_cleared
                                                        ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Check Cleared</Badge>
                                                        : <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50">Pending Clearance</Badge>
                                                }
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">{inv.recorded_by}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="new" className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 border rounded-xl bg-white shadow-sm">
                    <div className="space-y-2 flex flex-col justify-end">
                        <Label>Supplier</Label>
                        <Popover open={openSupplierBox} onOpenChange={setOpenSupplierBox}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={openSupplierBox} className="w-full justify-between">
                                    {supplierId ? suppliers.find((supplier) => supplier.supplier_id.toString() === supplierId)?.name : "Select supplier..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search supplier..." />
                                    <CommandEmpty>No supplier found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandList>
                                            {suppliers.map((supplier) => (
                                                <CommandItem
                                                    key={supplier.supplier_id}
                                                    value={supplier.name}
                                                    onSelect={() => { setSupplierId(supplier.supplier_id.toString()); setOpenSupplierBox(false); }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", supplierId === supplier.supplier_id.toString() ? "opacity-100" : "opacity-0")} />
                                                    {supplier.name}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Supplier Invoice #</Label>
                        <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
                    </div>

                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as any)}
                        >
                            <option value="Cash">Cash / Transfer</option>
                            <option value="Check">Post-Dated Check</option>
                        </select>
                    </div>

                    {paymentMethod === 'Check' && (
                        <>
                            <div className="space-y-2">
                                <Label>Check Number</Label>
                                <Input value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Check Date</Label>
                                <Input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} />
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Invoice Lines</h3>
                        <Button onClick={addRow} variant="secondary" size="sm" className="gap-2">
                            <Plus className="h-4 w-4" /> Add Row
                        </Button>
                    </div>

                    <div className="border rounded-md overflow-x-auto bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[300px]">Product</TableHead>
                                    <TableHead>Batch #</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="w-[100px]">Purch. Qty</TableHead>
                                    <TableHead className="w-[100px]">Bonus Qty</TableHead>
                                    <TableHead className="w-[120px]">Unit Cost ({currency})</TableHead>
                                    <TableHead className="w-[120px] text-right">Line Total</TableHead>
                                    <TableHead className="w-[60px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {batches.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            {!row.product_id ? (
                                                <Popover open={openProductBox === row.id} onOpenChange={(isOpen) => setOpenProductBox(isOpen ? row.id : null)}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start text-left text-muted-foreground font-normal" role="combobox" aria-expanded={openProductBox === row.id}>
                                                            Search product...
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 w-[400px]" side="bottom" align="start">
                                                        <Command shouldFilter={false}>
                                                            <CommandInput
                                                                placeholder="Type to search..."
                                                                value={searchQueries[row.id] || ""}
                                                                onValueChange={(q: string) => handleProductSearch(row.id, q)}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>No results.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {searchResults[row.id]?.map((prod) => (
                                                                        <CommandItem
                                                                            key={prod.product_id}
                                                                            value={`${prod.product_id}-${prod.name}`}
                                                                            onSelect={() => {
                                                                                selectProduct(row.id, prod);
                                                                                setOpenProductBox(null);
                                                                            }}
                                                                        >
                                                                            <Check className={cn("mr-2 h-4 w-4", row.product_id === prod.product_id ? "opacity-100" : "opacity-0")} />
                                                                            {prod.name} <span className="text-slate-400 ml-2 text-xs">({prod.measure_unit})</span>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm">{row.product_name}</span>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-600" onClick={() => { updateRow(row.id, "product_id", null); updateRow(row.id, "product_name", ""); }}>✕</Button>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Input value={row.batch_number} onChange={e => updateRow(row.id, "batch_number", e.target.value)} placeholder="B001" />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="date" value={row.expiry_date} onChange={e => updateRow(row.id, "expiry_date", e.target.value)} />
                                        </TableCell>
                                        <TableCell>
                                            <Input value={row.location} onChange={e => updateRow(row.id, "location", e.target.value)} placeholder="Shelf A" />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min="0" value={row.purchased_quantity || ''} onChange={e => updateRow(row.id, "purchased_quantity", e.target.value)} />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min="0" value={row.bonus_quantity || ''} onChange={e => updateRow(row.id, "bonus_quantity", e.target.value)} />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min="0" step="0.01" value={row.unit_cost || ''} onChange={e => updateRow(row.id, "unit_cost", e.target.value)} />
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {currency}{(Number(row.purchased_quantity) * Number(row.unit_cost)).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeRow(row.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {batches.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                                            Start adding products to this invoice using the Add Row button above.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button size="lg" className="w-[250px] font-bold text-lg" onClick={handleSubmit} disabled={isSubmitting || batches.length === 0}>
                        {isSubmitting ? "Posting..." : "Post GRN Draft"}
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
    );
}
