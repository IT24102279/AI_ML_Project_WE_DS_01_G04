import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CustomerChat from './components/CustomerChat';
import AdminDashboard from './components/AdminDashboard';
import ShopCustomer from './components/ShopCustomer';
import DriverApp from './components/DriverApp';

function App() {
    return (
        <Router>
            <div className="bg-slate-50 min-h-screen text-slate-900 font-sans">
                <div className="bg-yellow-100 border-b border-yellow-200 text-yellow-800 text-center py-2 text-sm font-semibold sticky top-0 z-50 shadow-sm">
                    ⚠️ WARNING: AI responses are for guidance only. Always verify medical information with a live Pharmacist.
                </div>

                <Routes>
                    <Route path="/" element={<CustomerChat />} />
                    <Route path="/shop" element={<ShopCustomer />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/driver" element={<DriverApp />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
