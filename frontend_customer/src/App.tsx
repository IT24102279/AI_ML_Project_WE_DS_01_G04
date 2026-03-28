import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CustomerChat from './components/CustomerChat';
import AdminDashboard from './components/AdminDashboard';
import ShopCustomer from './components/ShopCustomer';
import DriverApp from './components/DriverApp';
import Auth from './components/Auth';

function ProtectedRoute({ children, reqRole }: any) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return <Navigate to="/login" replace />;
    if (reqRole && user.role !== reqRole) return <Navigate to="/" replace />;
    return children;
}

function App() {
    return (
        <Router>
            <div className="bg-slate-50 min-h-screen text-slate-900 font-sans">
                <div className="bg-yellow-100 border-b border-yellow-200 text-yellow-800 text-center py-2 text-sm font-semibold sticky top-0 z-50 shadow-sm">
                    ⚠️ WARNING: AI responses are for guidance only. Always verify medical information with a live Pharmacist.
                </div>

                <Routes>
                    <Route path="/login" element={<Auth />} />
                    <Route path="/" element={<ProtectedRoute><CustomerChat /></ProtectedRoute>} />
                    <Route path="/shop" element={<ProtectedRoute><ShopCustomer /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute reqRole="admin"><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/driver" element={<DriverApp />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
