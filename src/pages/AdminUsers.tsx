import { useEffect, useState, useRef } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Edit, Trash2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  phone: string;
  role: string;
  name: string;
  password: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: '', phone: '', role: '', name: '', password: '' });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLDivElement>(null); // Ref for the form section

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const snapshot = await getDocs(collection(db, 'users'));
    const userList = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as { name: string; email: string; phone: string; role: string, password: string }),
    }));
    setUsers(userList);
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!form.email || !form.phone || !form.role || !form.name) return;

    if (isEditing) {
      const userRef = doc(db, 'users', isEditing);
      await updateDoc(userRef, { ...form });
      setUsers(prev =>
        prev.map(user => (user.id === isEditing ? { id: user.id, ...form } : user))
      );
      setIsEditing(null);
    } else {
      const docRef = await addDoc(collection(db, 'users'), { ...form });
      setUsers(prev => [...prev, { id: docRef.id, ...form }]);
    }

    setForm({ email: '', phone: '', role: '', name: '', password: '' });
  };

  const handleEdit = (user: User) => {
    setIsEditing(user.id);
    setForm({ email: user.email, phone: user.phone, role: user.role, name: user.name, password: user.password });
    formRef.current?.scrollIntoView({ behavior: 'smooth' }); // Scroll to form

  };

  const handleDelete = async (userId: string) => {
    await deleteDoc(doc(db, 'users', userId));
    setUsers(prev => prev.filter(user => user.id !== userId));
  };

  return (
    <div className="max-w-9xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Users</h1>
      {/* Form */}
      <div ref={formRef} className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleInputChange}
            placeholder="Name"
            className="border p-2 rounded w-full"
          />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleInputChange}
            placeholder="Email"
            className="border p-2 rounded w-full"
          />
          <input
            type="text"
            name="password"
            value={form.password}
            onChange={handleInputChange}
            placeholder="Password"
            className="border p-2 rounded w-full"
          />
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleInputChange}
            placeholder="Phone"
            className="border p-2 rounded w-full"
          />
          <input
            type="text"
            name="role"
            value={form.role}
            onChange={handleInputChange}
            placeholder="Role"
            className="border p-2 rounded w-full"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {isEditing ? 'Update User' : 'Add User'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="p-4 text-gray-500">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="p-4 text-gray-500">No users found.</p>
        ) : (
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border">Name</th>
                <th className="p-3 border">Email</th>
                <th className="p-3 border">Password</th>
                <th className="p-3 border">Phone</th>
                <th className="p-3 border">Role</th>
                <th className="p-3 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{user.name}</td>
                  <td className="p-3 border">{user.email}</td>
                  <td className="p-3 border">{user.password}</td>
                  <td className="p-3 border">{user.phone}</td>
                  <td className="p-3 border capitalize">{user.role}</td>
                  <td className="p-3 border space-x-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminUsers;
