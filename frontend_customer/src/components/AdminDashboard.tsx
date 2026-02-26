import { useState, useEffect } from 'react';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'chats' | 'appointments' | 'logistics' | 'products'>('chats');
    const [sessions, setSessions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [replyText, setReplyText] = useState('');
    const [internalNote, setInternalNote] = useState('');

    useEffect(() => {
        fetchSessions();
        fetchAppointments();
        fetchOrders();
        fetchProducts();
    }, []);

    // Set up product edit state
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Groceries', image_url: '', in_stock: true });

    // Poll active chat if selected
    useEffect(() => {
        if (!selectedSession) return;
        const fetchMsgs = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/admin/chat-sessions/${selectedSession}/messages`);
                if (res.ok) {
                    const data = await res.json();
                    setChatMessages(data);
                }
            } catch (e) { console.error(e); }
        };
        fetchMsgs();
        const intervalId = setInterval(fetchMsgs, 3000);
        return () => clearInterval(intervalId);
    }, [selectedSession]);

    const fetchSessions = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/admin/chat-sessions');
            if (res.ok) setSessions(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchAppointments = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/admin/appointments');
            if (res.ok) setAppointments(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchOrders = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/orders');
            if (res.ok) setOrders(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/admin/products');
            if (res.ok) setProducts(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch('http://localhost:4000/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct)
            });
            fetchProducts();
            setNewProduct({ name: '', price: '', category: 'Groceries', image_url: '', in_stock: true });
        } catch (e) { console.error(e); }
    };

    const handleUpdateProduct = async () => {
        if (!editingProduct) return;
        try {
            await fetch(`http://localhost:4000/api/admin/products/${editingProduct.product_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingProduct)
            });
            fetchProducts();
            setEditingProduct(null);
        } catch (e) { console.error(e); }
    };

    const handleDeleteProduct = async (id: number) => {
        if (!window.confirm('Delete this product?')) return;
        try {
            await fetch(`http://localhost:4000/api/admin/products/${id}`, { method: 'DELETE' });
            fetchProducts();
        } catch (e) { console.error(e); }
    };

    const smartAssignDriver = async (orderId: number) => {
        try {
            await fetch(`http://localhost:4000/api/orders/${orderId}/assign-driver`, { method: 'PUT' });
            fetchOrders();
        } catch (e) { console.error(e); }
    };

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedSession) return;
        try {
            await fetch(`http://localhost:4000/api/admin/chat-sessions/${selectedSession}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: replyText })
            });
            setReplyText('');
            // Optimistic or rely on polling (polling is fast enough)
        } catch (e) { console.error(e); }
    };

    const handleResolve = async () => {
        if (!selectedSession) return;
        try {
            await fetch(`http://localhost:4000/api/chat/sessions/${selectedSession}/resolve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ internal_note: internalNote })
            });
            alert('Session resolved');
            setSelectedSession(null);
            setInternalNote('');
            fetchSessions();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-40px)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Support Desk</h1>
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'chats' ? 'bg-white shadow relative text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('chats')}
                    >
                        Live Chats
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'appointments' ? 'bg-white shadow relative text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('appointments')}
                    >
                        Appointments
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'logistics' ? 'bg-white shadow relative text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('logistics')}
                    >
                        Online Orders & Logistics
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'products' ? 'bg-white shadow relative text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('products')}
                    >
                        Shop Products Manager
                    </button>
                </div>
            </div>

            {activeTab === 'appointments' && (
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="p-4 font-semibold text-slate-600">ID</th>
                                <th className="p-4 font-semibold text-slate-600">Time</th>
                                <th className="p-4 font-semibold text-slate-600">Customer ID</th>
                                <th className="p-4 font-semibold text-slate-600">Notes</th>
                                <th className="p-4 font-semibold text-slate-600">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(app => (
                                <tr key={app.id} className="border-b hover:bg-slate-50">
                                    <td className="p-4 text-sm">#{app.id}</td>
                                    <td className="p-4 text-sm font-medium">{new Date(app.scheduled_time).toLocaleString()}</td>
                                    <td className="p-4 text-sm">CUST-{app.customer_id}</td>
                                    <td className="p-4 text-sm max-w-xs truncate text-slate-500">{app.symptoms_note || '-'}</td>
                                    <td className="p-4 text-sm">
                                        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full text-xs font-semibold">
                                            {app.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {appointments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">No appointments scheduled.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'logistics' && (
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="p-4 font-semibold text-slate-600">Order Ref</th>
                                <th className="p-4 font-semibold text-slate-600">Customer ID</th>
                                <th className="p-4 font-semibold text-slate-600">Total Price</th>
                                <th className="p-4 font-semibold text-slate-600">Status</th>
                                <th className="p-4 font-semibold text-slate-600 text-right">Logistics Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.order_id} className="border-b hover:bg-slate-50">
                                    <td className="p-4 text-sm font-bold">ORD-{order.order_id}</td>
                                    <td className="p-4 text-sm">#{order.customer_id}</td>
                                    <td className="p-4 text-sm font-medium text-emerald-700">LKR {Number(order.total_amount).toFixed(2)}</td>
                                    <td className="p-4 text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${order.status === 'Pending' ? 'bg-red-100 text-red-800' :
                                            order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                            {order.status}
                                        </span>
                                        {order.driver_id && <div className="text-[10px] mt-1 text-slate-500 font-bold">Driver ID: {order.driver_id}</div>}
                                    </td>
                                    <td className="p-4 text-sm text-right">
                                        {order.status === 'Pending' ? (
                                            <button
                                                onClick={() => smartAssignDriver(order.order_id)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded text-xs transition-colors shadow-sm"
                                            >
                                                ⚡ Smart Assign Driver
                                            </button>
                                        ) : (
                                            <span className="text-slate-400 italic text-xs">Assigned</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">No active orders in the queue.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'products' && (
                <div className="flex flex-col gap-6 flex-1">
                    <div className="bg-white border rounded-lg shadow-sm p-4">
                        <h3 className="font-bold text-slate-800 mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                        <form onSubmit={editingProduct ? (e) => { e.preventDefault(); handleUpdateProduct(); } : handleCreateProduct} className="flex gap-4">
                            <input
                                type="text"
                                placeholder="Product Name"
                                className="border rounded px-3 py-2 flex-1"
                                value={editingProduct ? editingProduct.name : newProduct.name}
                                onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, name: e.target.value }) : setNewProduct({ ...newProduct, name: e.target.value })}
                                required
                            />
                            <input
                                type="number"
                                step="0.01"
                                placeholder="Price"
                                className="border rounded px-3 py-2 w-32"
                                value={editingProduct ? editingProduct.price : newProduct.price}
                                onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, price: e.target.value }) : setNewProduct({ ...newProduct, price: e.target.value })}
                                required
                            />
                            <select
                                className="border rounded px-3 py-2"
                                value={editingProduct ? editingProduct.category : newProduct.category}
                                onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, category: e.target.value }) : setNewProduct({ ...newProduct, category: e.target.value })}
                            >
                                <option>Groceries</option>
                                <option>First Aid</option>
                                <option>Medicine</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Image URL"
                                className="border rounded px-3 py-2 flex-1"
                                value={editingProduct ? editingProduct.image_url : newProduct.image_url}
                                onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, image_url: e.target.value }) : setNewProduct({ ...newProduct, image_url: e.target.value })}
                            />
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={editingProduct ? editingProduct.in_stock : newProduct.in_stock}
                                    onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, in_stock: e.target.checked }) : setNewProduct({ ...newProduct, in_stock: e.target.checked })}
                                /> In Stock
                            </label>
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg">
                                {editingProduct ? 'Save Changes' : 'Add Product'}
                            </button>
                            {editingProduct && (
                                <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-500 hover:underline">Cancel</button>
                            )}
                        </form>
                    </div>

                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden flex-1 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b">
                                    <th className="p-4 font-semibold text-slate-600">ID</th>
                                    <th className="p-4 font-semibold text-slate-600">Product</th>
                                    <th className="p-4 font-semibold text-slate-600">Category</th>
                                    <th className="p-4 font-semibold text-slate-600">Price</th>
                                    <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(p => (
                                    <tr key={p.product_id} className="border-b hover:bg-slate-50">
                                        <td className="p-4 text-sm">#{p.product_id}</td>
                                        <td className="p-4 text-sm font-bold flex items-center gap-3">
                                            <img src={p.image_url} className="w-8 h-8 rounded bg-slate-100 object-cover" alt="" />
                                            {p.name}
                                        </td>
                                        <td className="p-4 text-sm">
                                            <span className={p.category === 'Medicine' ? 'text-red-500 font-bold' : ''}>{p.category}</span>
                                        </td>
                                        <td className="p-4 text-sm">LKR {Number(p.price).toFixed(2)}</td>
                                        <td className="p-4 text-sm text-right flex justify-end gap-2">
                                            <button onClick={() => setEditingProduct(p)} className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1">Edit</button>
                                            <button onClick={() => handleDeleteProduct(p.product_id)} className="text-red-600 hover:text-red-800 font-medium px-2 py-1">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {products.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">No products configured.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'chats' && (
                <div className="flex gap-6 flex-1 overflow-hidden">
                    {/* Incoming Sessions List */}
                    <div className="w-1/3 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b font-semibold text-slate-700">Inbox</div>
                        <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-2">
                            {sessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSession(s.id)}
                                    className={`text-left p-3 rounded-md border transition-colors ${selectedSession === s.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-sm">Customer #{s.customer_id}</span>
                                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${s.status === 'Active' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
                                            {s.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                        Started {new Date(s.started_at).toLocaleTimeString()}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Active Work Desk */}
                    {selectedSession ? (
                        <div className="w-2/3 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
                            <div className="bg-blue-50 p-4 border-b flex justify-between items-center">
                                <div>
                                    <h2 className="font-bold text-blue-900">Session Workspace</h2>
                                    <p className="text-xs text-blue-700 font-mono">{selectedSession}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Internal resolution note..."
                                        className="text-sm px-2 py-1 rounded border"
                                        value={internalNote}
                                        onChange={e => setInternalNote(e.target.value)}
                                    />
                                    <button onClick={handleResolve} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1 rounded transition-colors font-medium">
                                        Mark Resolved
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-slate-50/50">
                                {chatMessages.map(m => (
                                    <div key={m.id} className={`max-w-[80%] rounded-lg p-3 ${m.sender === 'Customer' ? 'bg-white border self-start' :
                                        m.sender === 'LLM' ? 'bg-slate-200 text-slate-700 self-end text-sm' :
                                            'bg-blue-100 border border-blue-200 text-blue-900 self-end shadow-sm'
                                        }`}>
                                        <div className="text-xs font-bold mb-1 opacity-70">
                                            {m.sender === 'LLM' ? '🤖 AI Autoreply' : m.sender === 'Pharmacist' ? '⚕️ Official Reply' : 'User'}
                                        </div>
                                        <div className="whitespace-pre-wrap">{m.content}</div>
                                        {m.internal_note && (
                                            <div className="mt-2 pt-2 border-t border-emerald-300 text-xs text-emerald-800 font-medium">
                                                Internal: {m.internal_note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 border-t bg-white">
                                <form onSubmit={handleReply} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        placeholder="Intervene in chat (sends directly to customer)..."
                                        className="flex-1 border rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-6 rounded transition-colors">
                                        Send Reply
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="w-2/3 bg-slate-50 border rounded-lg border-dashed flex items-center justify-center text-slate-400">
                            Select a session from the inbox to review.
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
