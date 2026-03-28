import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ShoppingCart, LogOut, MessageSquare, Truck, Clock } from 'lucide-react';

interface Product {
    product_id: number;
    name: string;
    price: string;
    category: string;
    image_url: string;
    in_stock: boolean;
}

interface CartItem {
    cart_item_id?: number;
    product_id: number;
    name: string;
    price: string;
    quantity: number;
}

export default function ShopCustomer() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [statusMsg, setStatusMsg] = useState('');
    const [isPreorder, setIsPreorder] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const user = JSON.parse(localStorage.getItem('user') || '{"user_id":1}');
    const customerId = user.user_id;

    useEffect(() => {
        fetchProducts();
        fetchStatus();
        fetchCart();
        fetchOrders();

        // Optional polling for order status
        const intervalId = setInterval(fetchOrders, 10000);
        return () => clearInterval(intervalId);
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/shop/products');
            if (res.ok) setProducts(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchStatus = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/shop/status');
            if (res.ok) {
                const data = await res.json();
                setIsPreorder(data.is_preorder_only);
                setStatusMsg(data.message);
            }
        } catch (e) { console.error(e); }
    };

    const fetchCart = async () => {
        try {
            const res = await fetch(`http://localhost:4000/api/cart/${customerId}`);
            if (res.ok) setCart(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchOrders = async () => {
        try {
            const res = await fetch(`http://localhost:4000/api/orders?customer_id=${customerId}`);
            if (res.ok) setOrders(await res.json());
        } catch (e) { console.error(e); }
    };

    const addToCart = async (product: Product) => {
        try {
            // Optimistic 
            const existing = cart.find(c => c.product_id === product.product_id);
            if (existing) {
                setCart(cart.map(c => c.product_id === product.product_id ? { ...c, quantity: c.quantity + 1 } : c));
            } else {
                setCart([...cart, { product_id: product.product_id, name: product.name, price: product.price, quantity: 1 }]);
            }

            await fetch('http://localhost:4000/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customer_id: customerId, product_id: product.product_id, quantity: 1 })
            });
            fetchCart(); // Sync IDs
        } catch (e) { console.error(e); }
    };

    const removeFromCart = async (cartItemId: number) => {
        try {
            setCart(cart.filter(c => c.cart_item_id !== cartItemId));
            await fetch(`http://localhost:4000/api/cart/remove/${cartItemId}`, { method: 'DELETE' });
        } catch (e) { console.error(e); }
    };

    const updateCartItem = async (cartItemId: number, newQuantity: number) => {
        try {
            if (newQuantity <= 0) return removeFromCart(cartItemId);
            
            // Optimistic update
            setCart(cart.map(c => c.cart_item_id === cartItemId ? { ...c, quantity: newQuantity } : c));

            const res = await fetch('http://localhost:4000/api/cart/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart_item_id: cartItemId, quantity: newQuantity })
            });
            if (!res.ok) fetchCart(); // Revert on failure
        } catch (e) {
            console.error(e);
            fetchCart();
        }
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        try {
            const res = await fetch('http://localhost:4000/api/orders/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customer_id: customerId })
            });
            if (res.ok) {
                alert("Order Placed Successfully!");
                setCart([]);
                fetchOrders();
            } else {
                alert("Checkout failed.");
            }
        } catch (e) { console.error(e); }
    };

    const cartTotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

    return (
        <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-6">

            {/* Product Grid Area */}
            <div className="w-full md:w-2/3 flex flex-col gap-4">
                {isPreorder && (
                    <div className="bg-amber-100 border border-amber-300 text-amber-900 p-4 rounded-lg font-medium shadow-sm flex items-center gap-3">
                        <Clock className="w-5 h-5 shrink-0" />
                        <span>Pre-Order Mode: {statusMsg}</span>
                    </div>
                )}

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-4 gap-4">
                    <h2 className="text-2xl font-bold text-slate-800 shrink-0">Pantry & Health Basics</h2>
                    
                    <div className="relative w-full md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <Link to="/" className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-sm bg-blue-50 px-3 py-1.5 rounded-full">
                            <MessageSquare className="w-4 h-4" />
                            <span>Go to Support</span>
                        </Link>
                        <button 
                            onClick={() => { localStorage.removeItem('user'); navigate('/login'); }} 
                            className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 p-2 rounded-full transition-all"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                        <div key={p.product_id} className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col">
                            <div className="h-40 bg-slate-100 flex items-center justify-center p-4">
                                <img src={p.image_url} alt={p.name} className="h-full object-contain mix-blend-multiply opacity-80" />
                            </div>
                            <div className="p-4 flex flex-col flex-1">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{p.category}</div>
                                <h3 className="font-semibold text-slate-800 text-lg leading-tight mb-2">{p.name}</h3>
                                <div className="mt-auto flex items-center justify-between">
                                    <span className="font-bold text-emerald-700 text-lg">LKR {Number(p.price).toFixed(2)}</span>
                                    <button
                                        onClick={() => addToCart(p)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Add to Cart
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div className="col-span-3 py-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                            Loading products... (or none available)
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Sidebar */}
            <div className="w-full md:w-1/3">
                <div className="bg-white border rounded-xl shadow-sm p-5 sticky top-20 flex flex-col max-h-[calc(100vh-100px)]">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex justify-between items-center bg-slate-50 -mx-5 -mt-5 p-5 border-b rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                            Your Cart
                        </div>
                        <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">{cart.length}</span>
                    </h2>

                    <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                        {cart.map(item => (
                            <div key={item.cart_item_id || Math.random()} className="flex justify-between items-start border-b pb-3">
                                <div>
                                    <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <button 
                                            onClick={() => updateCartItem(item.cart_item_id!, item.quantity - 1)}
                                            className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-bold border border-slate-200 transition-colors"
                                        >
                                            -
                                        </button>
                                        <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateCartItem(item.cart_item_id!, item.quantity + 1)}
                                            className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-bold border border-slate-200 transition-colors"
                                        >
                                            +
                                        </button>
                                        <span className="text-slate-400 text-[10px] ml-2 font-medium">LKR {Number(item.price).toFixed(2)} ea.</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="font-bold text-sm">LKR {(Number(item.price) * item.quantity).toFixed(2)}</span>
                                    {item.cart_item_id && (
                                        <button
                                            onClick={() => removeFromCart(item.cart_item_id!)}
                                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && (
                            <div className="text-center text-slate-300 py-12 flex flex-col items-center gap-2">
                                <ShoppingCart className="w-12 h-12 stroke-[1.5]" />
                                <p className="text-sm font-medium">Your cart is empty.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-medium text-slate-600">Subtotal</span>
                            <span className="font-bold text-xl">LKR {cartTotal.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                        >
                            Checkout Order
                        </button>
                    </div>

                    <div className="mt-6 pt-5 border-t border-dashed">
                        <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-emerald-600" />
                            Track Deliveries
                        </h2>
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                            {orders.map(order => (
                                <div key={order.order_id} className="bg-slate-50 border rounded p-2 text-sm flex flex-col gap-1">
                                    <div className="flex justify-between font-bold text-slate-700">
                                        <span>ORD-{order.order_id}</span>
                                        <span className={`px-2 py-[2px] rounded-full text-[9px] uppercase font-bold flex items-center ${
                                            order.status === 'Pending' ? 'bg-red-100 text-red-800' :
                                            order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>{order.status}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Ordered: {new Date(order.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            {orders.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-2">No active logistics/orders.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
