import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  PlusSquareIcon,
  Menu,
  LogOut,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admindashboard', icon: LayoutDashboard },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Contacts', href: '/admincontacts', icon: Users },
    { name: 'Add Users', href: '/adduser', icon: PlusSquareIcon },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('userEmail');
    navigate('/');
  };

  if (location.pathname === '/') return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex items-center justify-between px-4 py-3 bg-white shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-700 hover:text-gray-900 focus:outline-none transition-colors duration-200"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Task Manager</h1>
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-screen">
        <div
          className={`fixed z-40 inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full'
            } transition-transform duration-300 ease-in-out bg-white shadow-lg rounded-r-2xl md:static md:translate-x-0 md:w-16 md:hover:w-64 overflow-hidden transition-all duration-300 ease-in-out`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div>
            <div className="flex h-16 items-center justify-center border-b md:border-none relative">
              <img
                src="logo.png"
                alt="Logo"
                className={`h-10 w-10 transition-opacity duration-300 ease-in-out ${isHovered || sidebarOpen ? 'opacity-0 absolute invisible' : 'opacity-100'
                  }`}
              />
              <h1
                className={`text-xl font-bold text-gray-900 transition-opacity duration-300 ease-in-out ${isHovered || sidebarOpen ? 'opacity-100' : 'opacity-0 absolute invisible'
                  }`}
              >
                Task Manager
              </h1>
            </div>

            <nav className="mt-5 px-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <div key={item.name} className="relative group">
                    <Link
                      to={item.href}
                      className={`${isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        } flex items-center py-2 text-sm font-medium rounded-md transition-colors duration-200 ease-in-out w-full h-10 relative`}
                      onClick={() => setSidebarOpen(false)}
                      aria-label={item.name}
                    >
                      <div className="absolute left-3 flex items-center">
                        <Icon
                          className={`flex-shrink-0 h-5 w-5 ${isActive ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'
                            }`}
                        />
                      </div>
                      <span
                        className={`ml-10 transition-opacity duration-300 ease-in-out ${isHovered || sidebarOpen
                          ? 'opacity-100'
                          : 'opacity-0 absolute invisible'
                          }`}
                      >
                        {item.name}
                      </span>
                    </Link>
                    {!isHovered && !sidebarOpen && (
                      <div className="absolute left-16 top-1/2 transform -translate-y-1/2 z-50 hidden group-hover:block bg-gray-800 text-white text-xs rounded-md py-1 px-2 shadow-md transition-opacity duration-200">
                        {item.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="px-3 py-4 border-t absolute bottom-0 w-full">
            <div className="relative group">
              <button
                onClick={handleLogout}
                className={`w-full flex items-center py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors duration-200 ease-in-out h-10 relative`}
                aria-label="Logout"
              >
                <div className="absolute left-3 flex items-center">
                  <LogOut className="flex-shrink-0 h-5 w-5" />
                </div>
                <span
                  className={`ml-10 transition-opacity duration-300 ease-in-out ${isHovered || sidebarOpen
                    ? 'opacity-100'
                    : 'opacity-0 absolute invisible'
                    }`}
                >
                  Logout
                </span>
              </button>
              {!isHovered && !sidebarOpen && (
                <div className="absolute left-16 top-1/2 transform -translate-y-1/2 z-50 hidden group-hover:block bg-gray-800 text-white text-xs rounded-md py-1 px-2 shadow-md transition-opacity duration-200">
                  Logout
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default Layout;