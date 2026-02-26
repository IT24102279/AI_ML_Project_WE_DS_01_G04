import { useState, useEffect } from 'react';

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
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isPreorder, setIsPreorder] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const customerId = 1; // Assuming same mock user as the chat

    useEffect(() => {
        fetchProducts();
        fetchStatus();
        fetchCart();
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
                    <div className="bg-amber-100 border border-amber-300 text-amber-900 p-4 rounded-lg font-medium shadow-sm">
                        ⚠️ Pre-Order Mode: {statusMsg}
                    </div>
                )}

                <h2 className="text-2xl font-bold text-slate-800 border-b pb-2">Pantry & Health Basics</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map(p => (
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
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex justify-between items-center">
                        Your Cart <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">{cart.length}</span>
                    </h2>

                    <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                        {cart.map(item => (
                            <div key={item.cart_item_id || Math.random()} className="flex justify-between items-start border-b pb-3">
                                <div>
                                    <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                                    <div className="text-slate-500 text-xs mt-1">LKR {Number(item.price).toFixed(2)} x {item.quantity}</div>
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
                            <div className="text-center text-slate-400 py-8 flex flex-col items-center gap-2">
                                <span className="text-4xl">🛒</span>
                                <p>Your cart is empty.</p>
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
                        <p className="text-xs text-center text-slate-500 mt-3">Free local delivery on all orders.</p>
                    </div>
                </div>
            </div>

        </div>
    );
}
