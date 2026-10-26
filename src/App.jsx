import { Route, Routes } from 'react-router-dom';
import SiteApp from './site/SiteApp.jsx';
import AdminApp from './admin/AdminApp.jsx';
import AdminLogin from './admin/Login.jsx';
import DeparturesTV from './admin/DeparturesTV.jsx';
import MobileApp from './app/MobileApp.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/departures-tv" element={<DeparturesTV />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/app/*" element={<MobileApp />} />
      <Route path="/*" element={<SiteApp />} />
    </Routes>
  );
}
