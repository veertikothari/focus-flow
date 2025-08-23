import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';          // Admin Sidebar Layout
import { UserLayout } from './components/UserLayout';  // User Sidebar Layout
import { Login } from './pages/Login';
import { Dashboard } from './pages/AdminDashboard';         // Admin Dashboard
import { AdminTasks } from './pages/AdminTasks';
import { Contacts } from './pages/Contacts';
import { UserDashboard } from './pages/UserDashboard'; // User Dashboard
import { AdminContacts } from './pages/AdminContacts';
import { AdminUsers } from './pages/AdminUsers';
import { Tasks } from './pages/Tasks';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/admindashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/tasks"
          element={
            <Layout>
              <AdminTasks />
            </Layout>
          }
        />
        <Route
          path="/admincontacts"
          element={
            <Layout>
              <AdminContacts />
            </Layout>
          }
        />
        <Route
          path="/adduser"
          element={
            <Layout>
              <AdminUsers />
            </Layout>
          }
        />
        <Route
          path="/userdashboard"
          element={
            <UserLayout>
              <UserDashboard />
            </UserLayout>
          }
        />
        <Route
          path="/usertasks"
          element={
            <UserLayout>
              <Tasks />
            </UserLayout>
          }
        />
        <Route
          path="/contacts"
          element={
            <UserLayout>
              <Contacts />
            </UserLayout>
          }
        />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
