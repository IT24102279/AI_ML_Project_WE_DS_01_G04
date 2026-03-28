import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MessageCircle, 
    Calendar, 
    Truck, 
    PackageSearch, 
    Users, 
    LogOut, 
    Zap, 
    Trash2, 
    CheckCircle2, 
    LayoutDashboard,
    Bot,
    User
} from 'lucide-react';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'chats' | 'appointments' | 'logistics' | 'products' | 'drivers'>('chats');
    const [sessions, setSessions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [replyText, setReplyText] = useState('');
    const [internalNote, setInternalNote] = useState('');

    useEffect(() => {
        fetchSessions();
        fetchAppointments();
        fetchOrders();
        fetchProducts();
        fetchDrivers();
    }, []);

    // Set up product edit state
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Groceries', image_url: '', in_stock: true });

    // Set up driver edit state
    const [editingDriver, setEditingDriver] = useState<any | null>(null);
    const [newDriver, setNewDriver] = useState({ name: '', vehicle_info: '', status: 'Active' });

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

    const fetchDrivers = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/admin/drivers');
            if (res.ok) setDrivers(await res.json());
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
            const res = await fetch(`http://localhost:4000/api/orders/${orderId}/assign-driver`, { method: 'PUT' });
            if (!res.ok) alert("Failed. No active or available drivers right now.");
            fetchOrders();
        } catch (e) { console.error(e); }
    };

    const manualAssignDriver = async (orderId: number, driverId: number) => {
        try {
            await fetch(`http://localhost:4000/api/admin/orders/${orderId}/assign-driver`, { 
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_id: driverId })
            });
            fetchOrders();
        } catch (e) { console.error(e); }
    };

    const handleCreateDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch('http://localhost:4000/api/admin/drivers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDriver)
            });
            fetchDrivers();
            setNewDriver({ name: '', vehicle_info: '', status: 'Active' });
        } catch (e) { console.error(e); }
    };

    const handleUpdateDriver = async () => {
        if (!editingDriver) return;
        try {
            await fetch(`http://localhost:4000/api/admin/drivers/${editingDriver.driver_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingDriver)
            });
            fetchDrivers();
            setEditingDriver(null);
        } catch (e) { console.error(e); }
    };

    const handleDeleteDriver = async (id: number) => {
        if (!window.confirm('Delete this driver?')) return;
        try {
            await fetch(`http://localhost:4000/api/admin/drivers/${id}`, { method: 'DELETE' });
            fetchDrivers();
        } catch (e) { console.error(e); }
    };

    const handleUpdateAppointmentStatus = async (id: number, status: string) => {
        try {
            await fetch(`http://localhost:4000/api/admin/appointments/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchAppointments();
        } catch (e) { console.error(e); }
    };

    const handleDeleteAppointment = async (id: number) => {
        if (!window.confirm('Delete this appointment?')) return;
        try {
            await fetch(`http://localhost:4000/api/appointments/${id}`, { method: 'DELETE' });
            fetchAppointments();
        } catch (e) { console.error(e); }
    };

    const handleUpdateOrderStatus = async (id: number, status: string) => {
        try {
            await fetch(`http://localhost:4000/api/admin/orders/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchOrders();
        } catch (e) { console.error(e); }
    };

    const handleDeleteOrder = async (id: number) => {
        if (!window.confirm('Delete this order?')) return;
        try {
            await fetch(`http://localhost:4000/api/admin/orders/${id}`, { method: 'DELETE' });
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

    const handleSignOut = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-40px)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <LayoutDashboard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Support Desk</h1>
                        <button onClick={handleSignOut} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 mt-0.5">
                            <LogOut className="w-3 h-3" />
                            Sign Out
                        </button>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-xl border shadow-sm">
                    <button
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'chats' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('chats')}
                    >
                        <MessageCircle className="w-4 h-4" />
                        Live Chats
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'appointments' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('appointments')}
                    >
                        <Calendar className="w-4 h-4" />
                        Appointments
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'logistics' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('logistics')}
                    >
                        <Truck className="w-4 h-4" />
                        Logistics
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'products' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('products')}
                    >
                        <PackageSearch className="w-4 h-4" />
                        Inventory
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'drivers' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
                        onClick={() => setActiveTab('drivers')}
                    >
                        <Users className="w-4 h-4" />
                        Fleet Control
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
                                <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
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
                                        <select
                                            className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer border ${app.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-800 border-slate-300'}`}
                                            value={app.status}
                                            onChange={(e) => handleUpdateAppointmentStatus(app.id, e.target.value)}
                                        >
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="Resolved">Resolved</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </td>
                                    <td className="p-4 text-sm text-right">
                                        <button onClick={() => handleDeleteAppointment(app.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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
                                <th className="p-4 font-semibold text-slate-600">Customer Details</th>
                                <th className="p-4 font-semibold text-slate-600">Items Ordered</th>
                                <th className="p-4 font-semibold text-slate-600">Total Price</th>
                                <th className="p-4 font-semibold text-slate-600">Status</th>
                                <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.order_id} className="border-b hover:bg-slate-50">
                                    <td className="p-4 text-sm font-bold w-24">ORD-{order.order_id}</td>
                                    <td className="p-4 text-sm">
                                        <div className="font-bold text-slate-800">{order.customer_name || `CUST-${order.customer_id}`}</div>
                                        <div className="text-xs text-slate-500">{order.customer_phone || ''}</div>
                                        <div className="text-xs text-slate-500 max-w-[150px] truncate" title={order.customer_address}>{order.customer_address || ''}</div>
                                    </td>
                                    <td className="p-4 text-sm">
                                        <ul className="list-disc pl-4 text-xs text-slate-600">
                                            {order.items?.map((item: any, i: number) => (
                                                <li key={i}>{item.quantity}x {item.name}</li>
                                            ))}
                                            {!order.items?.length && <li className="text-slate-400 list-none">No items</li>}
                                        </ul>
                                    </td>
                                    <td className="p-4 text-sm font-medium text-emerald-700 w-24 whitespace-nowrap">LKR {Number(order.total_amount).toFixed(2)}</td>
                                    <td className="p-4 text-sm">
                                        <select
                                            className={`px-2 py-1 rounded-full text-xs font-bold uppercase cursor-pointer border shadow-sm ${order.status === 'Pending' ? 'bg-red-100 text-red-800 border-red-300' :
                                                order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                                    'bg-blue-100 text-blue-800 border-blue-300'
                                                }`}
                                            value={order.status}
                                            onChange={(e) => handleUpdateOrderStatus(order.order_id, e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Packing">Packing</option>
                                            <option value="Handed to Driver">Handed to Driver</option>
                                            <option value="Delivered">Delivered</option>
                                        </select>
                                        {order.driver_id && <div className="text-[10px] mt-1 text-slate-500 font-bold">Driver ID: {order.driver_id}</div>}
                                    </td>
                                    <td className="p-4 text-sm text-right flex gap-2 justify-end items-center">
                                        {order.status === 'Pending' && (
                                            <div className="flex bg-slate-100 rounded border">
                                                <select 
                                                    className="bg-transparent text-xs p-1 outline-none font-medium cursor-pointer"
                                                    onChange={e => manualAssignDriver(order.order_id, Number(e.target.value))}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Manual Assign...</option>
                                                    {drivers.filter(d => d.status === 'Active').map(d => (
                                                        <option key={d.driver_id} value={d.driver_id}>{d.name} ({d.driver_id})</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => smartAssignDriver(order.order_id)}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 transition-colors border-l"
                                                    title="Smart Assign"
                                                >
                                                    <Zap className="w-4 h-4 fill-current" />
                                                </button>
                                            </div>
                                        )}
                                        <button onClick={() => handleDeleteOrder(order.order_id)} className="text-red-500 hover:text-red-700 hover:bg-red-100 px-2 py-1 text-xs font-medium border border-red-200 bg-red-50 rounded">Delete</button>
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

            {activeTab === 'drivers' && (
                <div className="flex flex-col gap-6 flex-1">
                    <div className="bg-white border rounded-lg shadow-sm p-4">
                        <h3 className="font-bold text-slate-800 mb-4">{editingDriver ? 'Edit Driver' : 'Add New Driver'}</h3>
                        <form onSubmit={editingDriver ? (e) => { e.preventDefault(); handleUpdateDriver(); } : handleCreateDriver} className="flex gap-4">
                            <input
                                type="text"
                                placeholder="Driver Name"
                                className="border rounded px-3 py-2 flex-1"
                                value={editingDriver ? editingDriver.name : newDriver.name}
                                onChange={(e) => editingDriver ? setEditingDriver({ ...editingDriver, name: e.target.value }) : setNewDriver({ ...newDriver, name: e.target.value })}
                                required
                            />
                            <input
                                type="text"
                                placeholder="Vehicle Info (e.g., Van WP-1234)"
                                className="border rounded px-3 py-2 flex-1"
                                value={editingDriver ? editingDriver.vehicle_info : newDriver.vehicle_info}
                                onChange={(e) => editingDriver ? setEditingDriver({ ...editingDriver, vehicle_info: e.target.value }) : setNewDriver({ ...newDriver, vehicle_info: e.target.value })}
                            />
                            <select
                                className="border rounded px-3 py-2"
                                value={editingDriver ? editingDriver.status : newDriver.status}
                                onChange={(e) => editingDriver ? setEditingDriver({ ...editingDriver, status: e.target.value }) : setNewDriver({ ...newDriver, status: e.target.value })}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg">
                                {editingDriver ? 'Save Changes' : 'Add Driver'}
                            </button>
                            {editingDriver && (
                                <button type="button" onClick={() => setEditingDriver(null)} className="text-slate-500 hover:underline">Cancel</button>
                            )}
                        </form>
                    </div>

                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden flex-1 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b">
                                    <th className="p-4 font-semibold text-slate-600">Driver ID</th>
                                    <th className="p-4 font-semibold text-slate-600">Name</th>
                                    <th className="p-4 font-semibold text-slate-600">Vehicle Info</th>
                                    <th className="p-4 font-semibold text-slate-600">Status</th>
                                    <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {drivers.map(d => (
                                    <tr key={d.driver_id} className="border-b hover:bg-slate-50">
                                        <td className="p-4 text-sm font-medium">#{d.driver_id}</td>
                                        <td className="p-4 text-sm font-bold">{d.name}</td>
                                        <td className="p-4 text-sm text-slate-500">{d.vehicle_info || '-'}</td>
                                        <td className="p-4 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${d.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                {d.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-right flex justify-end gap-2">
                                            <button onClick={() => setEditingDriver(d)} className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1">Edit</button>
                                            <button onClick={() => handleDeleteDriver(d.driver_id)} className="text-red-600 hover:text-red-800 font-medium px-2 py-1">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {drivers.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">No drivers configured.</td></tr>
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
                                        <div className="text-[10px] font-bold mb-1 opacity-70 flex items-center gap-1 uppercase tracking-wider">
                                            {m.sender === 'LLM' ? <Bot className="w-3 h-3" /> : m.sender === 'Pharmacist' ? <CheckCircle2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                            {m.sender === 'LLM' ? 'AI Assistant' : m.sender === 'Pharmacist' ? 'Pharmacist' : 'Customer'}
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
