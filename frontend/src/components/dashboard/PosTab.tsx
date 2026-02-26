import { useState, useEffect, useRef } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Check, ChevronsUpDown, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { io, Socket } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import PatientSelector from "../pos/PatientSelector";

interface ProductSearchResult {
    product_id: number;
    name: string;
    measure_unit: string;
    total_stock: number;
    selling_price: number;
    batches: any[];
}

interface CartItem {
    id: string; // unique row id
    product_id: number | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    frequency: string;
}

interface AiExtractedLine {
    medicine_name_raw: string;
    frequency: string;
    total_amount: number;
    matched_product_id: number | null;
    matched_product_name?: string;
    matched_unit_price?: number;
}

export default function PosTab({ currency = '$' }: { currency?: string }) {
    const { toast } = useToast();
    const navigate = useNavigate();

    // -- Cart State --
    const [cart, setCart] = useState<CartItem[]>([]);
    const [moneyGiven, setMoneyGiven] = useState<number>(0);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // -- Search State --
    const [openProductBox, setOpenProductBox] = useState<string | null>(null);
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
    const [searchResults, setSearchResults] = useState<Record<string, ProductSearchResult[]>>({});

    // -- Patient Discount Engine --
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [discountPct, setDiscountPct] = useState<number>(0);

    // -- AI Webhook State --
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [pendingAiRxId, setPendingAiRxId] = useState<number | null>(null);
    const [aiLines, setAiLines] = useState<AiExtractedLine[]>([]);
    const socketRef = useRef<Socket | null>(null);

    // AI Mapping State
    const [openAiMapBox, setOpenAiMapBox] = useState<number | null>(null); // Index of the aiLine being mapped
    const [aiSearchQueries, setAiSearchQueries] = useState<Record<number, string>>({});
    const [aiSearchResults, setAiSearchResults] = useState<Record<number, ProductSearchResult[]>>({});

    useEffect(() => {
        // Connect to Socket.io for Real-time AI Webhooks
        const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const socketUrl = backendUrl.replace('/api', '');

        socketRef.current = io(socketUrl);

        socketRef.current.on('new_ai_scan_received', (data: any) => {
            console.log("Real-time AI Scan Received:", data);
            setPendingAiRxId(data.prescription_id);
            setAiLines(data.extracted_lines || []);
            setAiModalOpen(true);
            toast({
                title: "AI Scan Received",
                description: "A new prescription was just processed by the AI.",
                variant: "default",
            });
        });

        // Add 1 default empty row to start
        if (cart.length === 0) {
            setCart([{ id: crypto.randomUUID(), product_id: null, product_name: "", quantity: 1, unit_price: 0, frequency: "" }]);
        }

        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    // --- Search Logic ---
    const handleSearch = async (rowId: string, q: string) => {
        setSearchQueries(prev => ({ ...prev, [rowId]: q }));
        if (q.length < 2) return;
        try {
            const data = await fetchWithAuth(`/pos/search?q=${encodeURIComponent(q)}`);
            setSearchResults(prev => ({ ...prev, [rowId]: data }));
        } catch (err) { }
    };

    const handleAiSearch = async (index: number, q: string) => {
        setAiSearchQueries(prev => ({ ...prev, [index]: q }));
        if (q.length < 2) return;
        try {
            const data = await fetchWithAuth(`/pos/search?q=${encodeURIComponent(q)}`);
            setAiSearchResults(prev => ({ ...prev, [index]: data }));
        } catch (err) { }
    };

    // --- Cart Manipulation ---
    const updateCartRow = (id: string, field: keyof CartItem, value: any) => {
        setCart(cart.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeCartRow = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const addCartRow = () => {
        setCart([...cart, { id: crypto.randomUUID(), product_id: null, product_name: "", quantity: 1, unit_price: 0, frequency: "" }]);
    };

    const selectProduct = (rowId: string, prod: ProductSearchResult) => {
        setCart(cart.map(item => item.id === rowId ? {
            ...item,
            product_id: prod.product_id,
            product_name: prod.name,
            unit_price: Number(prod.selling_price) || 0
        } : item));
    };

    const selectAiProductMapping = (index: number, prod: ProductSearchResult) => {
        const newLines = [...aiLines];
        newLines[index].matched_product_id = prod.product_id;
        newLines[index].matched_product_name = prod.name;
        newLines[index].matched_unit_price = Number(prod.selling_price) || 0;
        setAiLines(newLines);
    };

    // --- Totals ---
    const cartSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discountAmount = cartSubtotal * (discountPct / 100);
    const discountedTotal = cartSubtotal - discountAmount;
    const balanceDue = Math.max(0, discountedTotal - moneyGiven);
    const changeDue = Math.max(0, moneyGiven - discountedTotal);

    // --- AI Autofill Verification ---
    const handleVerifyAiData = () => {
        // Only transfer verified (mapped) items to cart
        const verifiedItems = aiLines.filter(line => line.matched_product_id !== null).map(line => ({
            id: crypto.randomUUID(),
            product_id: line.matched_product_id!,
            product_name: line.matched_product_name || line.medicine_name_raw,
            quantity: line.total_amount || 1,
            unit_price: line.matched_unit_price || 0,
            frequency: line.frequency || ''
        }));

        if (verifiedItems.length > 0) {
            // Remove empty unselected rows from current cart
            const currentCleanCart = cart.filter(item => item.product_id !== null);
            setCart([...currentCleanCart, ...verifiedItems]);
            toast({ title: "Autofill Complete", description: `Added ${verifiedItems.length} verified items to the cart.` });
        }
        setAiModalOpen(false);
    };

    // --- Checkout Logic ---
    const handleCheckout = async () => {
        const validItems = cart.filter(item => item.product_id !== null && item.quantity > 0);
        if (validItems.length === 0) {
            toast({ title: "Cart is empty", variant: "destructive" });
            return;
        }

        setIsCheckingOut(true);
        try {
            const payload = {
                is_over_the_counter: !selectedPatientId,
                patient_id: selectedPatientId,
                prescription_id: pendingAiRxId,
                payment_method: moneyGiven > 0 ? 'Cash' : 'Pending',
                total_amount: discountedTotal,
                money_given: moneyGiven,
                items: validItems.map(item => ({
                    product_id: item.product_id,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price)
                }))
            };

            const res = await fetchWithAuth('/pos/checkout', { method: 'POST', body: JSON.stringify(payload) });

            toast({ title: "Sale Completed", description: `Change Due: ${currency}${res.change_due.toFixed(2)}` });

            // Navigate to receipt
            navigate(`/receipt/${res.invoice_id}`);

        } catch (error: any) {
            toast({ title: "Checkout Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 pb-20">
            {/* Left Panel: Bill Summary */}
            <div className="md:w-1/3 bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col shadow-sm">

                <PatientSelector
                    onPatientSelect={(id, pct) => {
                        setSelectedPatientId(id);
                        setDiscountPct(pct);
                    }}
                />

                <h2 className="text-2xl font-bold mb-6 text-slate-800 border-t pt-4">Current Sale</h2>

                <div className="flex-1 overflow-y-auto mb-6">
                    {cart.filter(item => item.product_id !== null).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-3 border-b border-slate-200 last:border-0">
                            <div>
                                <p className="font-semibold text-slate-800">{item.product_name}</p>
                                <p className="text-sm text-slate-500">{item.quantity} x {currency}{Number(item.unit_price || 0).toFixed(2)}</p>
                            </div>
                            <p className="font-bold text-slate-900">{currency}{(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)}</p>
                        </div>
                    ))}
                    {cart.filter(item => item.product_id !== null).length === 0 && (
                        <div className="text-center py-10 text-slate-400">Cart is empty.</div>
                    )}
                </div>

                <div className="border-t border-slate-300 pt-4 space-y-3">
                    <div className="flex justify-between items-center text-sm text-slate-500">
                        <span>Cart Subtotal:</span>
                        <span>{currency}{cartSubtotal.toFixed(2)}</span>
                    </div>

                    {discountPct > 0 && (
                        <div className="flex justify-between items-center text-sm text-green-600 font-medium">
                            <span>Patient Discount ({discountPct}%):</span>
                            <span>-{currency}{discountAmount.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span className="text-2xl text-blue-700">{currency}{discountedTotal.toFixed(2)}</span>
                    </div>

                    <div className="space-y-1 mt-4">
                        <Label>Money Given</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={moneyGiven || ''}
                            onChange={(e) => setMoneyGiven(e.target.value ? Number(e.target.value) : 0)}
                            className="text-lg font-semibold"
                        />
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">Balance Due:</span>
                        <span className="font-medium text-amber-600">{currency}{balanceDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">Change:</span>
                        <span className="font-medium text-green-600">{currency}{changeDue.toFixed(2)}</span>
                    </div>

                    <Button
                        size="lg"
                        className="w-full mt-4 text-lg font-bold py-6"
                        disabled={isCheckingOut || discountedTotal === 0 || aiModalOpen}
                        onClick={handleCheckout}
                    >
                        {isCheckingOut ? "Processing..." : "Confirm Checkout"}
                    </Button>
                </div>
            </div>

            {/* Right Panel: Manual Entry Grid */}
            <div className="md:w-2/3 space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Items</h2>
                    {aiLines.length > 0 && !aiModalOpen && (
                        <Button variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100" onClick={() => setAiModalOpen(true)}>
                            <Zap className="h-4 w-4 mr-2" /> Review Pending AI Data
                        </Button>
                    )}
                </div>

                <div className="border rounded-md bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[300px]">Search Product</TableHead>
                                <TableHead className="w-[120px]">Frequency</TableHead>
                                <TableHead className="w-[100px]">Qty</TableHead>
                                <TableHead className="w-[120px]">Unit Price</TableHead>
                                <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                                <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cart.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        {!row.product_id ? (
                                            <Popover open={openProductBox === row.id} onOpenChange={(isOpen) => setOpenProductBox(isOpen ? row.id : null)}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-left text-muted-foreground font-normal" role="combobox" aria-expanded={openProductBox === row.id}>
                                                        Scan or type...
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 w-[400px]" side="bottom" align="start">
                                                    <Command shouldFilter={false}>
                                                        <CommandInput
                                                            placeholder="Type to search products..."
                                                            value={searchQueries[row.id] || ""}
                                                            onValueChange={(q: string) => handleSearch(row.id, q)}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No results found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {searchResults[row.id]?.map((prod) => (
                                                                    <CommandItem
                                                                        key={prod.product_id}
                                                                        value={`${prod.product_id}`}
                                                                        onSelect={() => {
                                                                            selectProduct(row.id, prod);
                                                                            setOpenProductBox(null);
                                                                        }}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", row.product_id === prod.product_id ? "opacity-100" : "opacity-0")} />
                                                                        <div className="flex flex-col">
                                                                            <span>{prod.name} ({prod.measure_unit})</span>
                                                                            <span className="text-xs text-slate-500">Stock: {prod.total_stock} | Price: {currency}{prod.selling_price}</span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm text-slate-700">{row.product_name}</span>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-300 hover:text-red-600" onClick={() => { updateCartRow(row.id, "product_id", null); updateCartRow(row.id, "product_name", ""); }}>✕</Button>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Select value={row.frequency} onValueChange={v => updateCartRow(row.id, "frequency", v)}>
                                            <SelectTrigger className="w-[110px] bg-white">
                                                <SelectValue placeholder="Freq..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OD">OD (1/day)</SelectItem>
                                                <SelectItem value="BID">BID (2/day)</SelectItem>
                                                <SelectItem value="TID">TID (3/day)</SelectItem>
                                                <SelectItem value="QID">QID (4/day)</SelectItem>
                                                <SelectItem value="Q4H">Q4H (Every 4hrs)</SelectItem>
                                                <SelectItem value="Q8H">Q8H (Every 8hrs)</SelectItem>
                                                <SelectItem value="STAT">STAT (Now)</SelectItem>
                                                <SelectItem value="PRN">PRN (As needed)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" min="1" value={row.quantity || ''} onChange={e => updateCartRow(row.id, "quantity", Number(e.target.value))} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" min="0" step="0.01" value={row.unit_price || ''} onChange={e => updateCartRow(row.id, "unit_price", Number(e.target.value))} />
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-slate-700">
                                        {currency}{(Number(row.quantity || 0) * Number(row.unit_price || 0)).toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeCartRow(row.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <Button onClick={addCartRow} variant="outline" className="w-full border-dashed border-slate-300 text-slate-500 hover:text-slate-700">
                    + Add Empty Row
                </Button>
            </div>

            {/* AI Verification Modal */}
            <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center text-xl text-purple-800">
                            <Zap className="h-5 w-5 mr-2 text-purple-600" /> AI Prescription Output Verification
                        </DialogTitle>
                        <DialogDescription>
                            Review the raw extracted text and map them to actual inventory products.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Raw Extract (Doctor's Note)</TableHead>
                                    <TableHead className="w-[100px]">Freq.</TableHead>
                                    <TableHead className="w-[80px]">Qty</TableHead>
                                    <TableHead className="w-[250px]">Map to Local Product</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {aiLines.map((line, idx) => (
                                    <TableRow key={idx} className={line.matched_product_id ? "bg-green-50/50" : "bg-amber-50/50"}>
                                        <TableCell className="font-mono text-xs">{line.medicine_name_raw}</TableCell>
                                        <TableCell>{line.frequency}</TableCell>
                                        <TableCell>{line.total_amount}</TableCell>
                                        <TableCell>
                                            <Popover open={openAiMapBox === idx} onOpenChange={(isOpen) => setOpenAiMapBox(isOpen ? idx : null)}>
                                                <PopoverTrigger asChild>
                                                    <Button variant={line.matched_product_id ? "default" : "outline"} className={cn("w-full justify-between", line.matched_product_id ? "bg-green-600 hover:bg-green-700" : "border-amber-300 text-amber-800")} role="combobox">
                                                        {line.matched_product_name || "Select match..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 w-[400px]">
                                                    <Command shouldFilter={false}>
                                                        <CommandInput
                                                            placeholder="Search to map product..."
                                                            value={aiSearchQueries[idx] || line.medicine_name_raw}
                                                            onValueChange={(q) => handleAiSearch(idx, q)}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No matches found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {aiSearchResults[idx]?.map((prod) => (
                                                                    <CommandItem
                                                                        key={prod.product_id}
                                                                        value={`${prod.product_id}`}
                                                                        onSelect={() => {
                                                                            selectAiProductMapping(idx, prod);
                                                                            setOpenAiMapBox(null);
                                                                        }}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", line.matched_product_id === prod.product_id ? "opacity-100" : "opacity-0")} />
                                                                        {prod.name} (Stock: {prod.total_stock})
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAiModalOpen(false)}>Hold in Background</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleVerifyAiData}>Transfer to Cart</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
