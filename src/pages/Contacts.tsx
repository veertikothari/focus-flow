import React, { useEffect, useState, useRef } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trash2, Edit, MessageSquareText, Phone, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';
type User = {
  id: string;
  name: string;
  email: string;
};

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company_name: string;
  date_of_birth: string;
  date_of_anniversary: string;
  categories: string[];
  notes?: string;
  createdAt: Timestamp;
  uploadedBy: string;
  assignedTo: string[];
  railwayStation?: string;
};

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    company_name: '',
    date_of_birth: '',
    date_of_anniversary: '',
    categories: [] as string[],
    notes: '',
    assignedTo: [] as string[],
  });
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [isAssignedToDropdownOpen, setIsAssignedToDropdownOpen] = useState<boolean>(false);
  const [assignedToSearch, setAssignedToSearch] = useState<string>('');
  const email = localStorage.getItem('userEmail');
  const formRef = useRef<HTMLDivElement>(null);
  const assignedToDropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation(); // Add useLocation

  useEffect(() => {
    fetchCategories();
    fetchUsers();
    fetchContacts();
  }, []);

  // Scroll to contact based on URL hash
  useEffect(() => {
    const scrollToContact = () => {
      const hash = location.hash; // e.g., "#contact123"
      if (hash) {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        console.log('Scrolling to ID:', id, 'Element:', element); // Debug
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          element.classList.add('highlight');
          setTimeout(() => element.classList.remove('highlight'), 2000);
        }
      }
    };

    // Try scrolling immediately and retry after delays
    scrollToContact();
    const retryTimeout1 = setTimeout(scrollToContact, 500);
    const retryTimeout2 = setTimeout(scrollToContact, 1000);

    return () => {
      clearTimeout(retryTimeout1);
      clearTimeout(retryTimeout2);
    };
  }, [location.hash, contacts]); // Depend on hash and contacts

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const userData: User[] = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
      }));
      setUsers(userData);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    }
  };

  const fetchCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'contacts'));
      const allCategories = snapshot.docs
        .flatMap((doc, index) => {
          if (!doc.exists()) {
            console.warn(`fetchCategories: Document ${index} does not exist`);
            return [];
          }
          const data = doc.data();
          // Handle both old format (single category) and new format (categories array)
          if (Array.isArray(data.categories)) {
            return data.categories;
          } else if (data.category) {
            return [data.category];
          }
          return [];
        })
        .filter((cat): cat is string => cat !== undefined && cat.trim() !== '');
      const uniqueCategories = [...new Set(allCategories)];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Failed to load categories');
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'contacts'));
      const data: Contact[] = snapshot.docs
        .map((doc, index) => {
          if (!doc.exists()) {
            console.warn(`Document ${index} does not exist`);
            return null;
          }
          const docData = doc.data();
          // Handle migration from old format (single category) to new format (categories array)
          let categories = docData.categories;
          if (!categories && docData.category) {
            categories = [docData.category];
          }
          return {
            id: doc.id,
            ...docData,
            categories: categories || [],
            assignedTo: Array.isArray(docData.assignedTo) ? docData.assignedTo : docData.assignedTo ? [docData.assignedTo] : [],
          } as Contact;
        })
        .filter((contact) => contact.uploadedBy === email);

      setContacts(data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'railwayStation') {
      setStationSearchQuery(e.target.value);
      setIsStationDropdownOpen(true);
    }
  };

  const toggleAssignedTo = (userId: string) => {
    setForm((prev) => {
      const newAssignedTo = prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId];
      return { ...prev, assignedTo: newAssignedTo };
    });
    setAssignedToSearch('');
  };

  const getUserName = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.name} (${user.email})` : 'Unknown';
  };

  const handleClickOutside = (event: MouseEvent) => {
    const categoryDropdown = document.querySelector('.category-dropdown');
    if (categoryDropdown && !categoryDropdown.contains(event.target as Node)) {
      setIsCategoryDropdownOpen(false);
    }
    if (assignedToDropdownRef.current && !assignedToDropdownRef.current.contains(event.target as Node)) {
      setIsAssignedToDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error('Name and Phone number are required.');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(form.phone)) {
      toast.error('Enter a valid 10-digit phone number starting with 6, 7, 8, or 9.');
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, 'contacts'));
      const exists = snapshot.docs.some(
        (doc) => doc.data().phone === form.phone && doc.id !== editContactId
      );

      if (exists) {
        toast.error('A contact with this number already exists.');
        return;
      }

      if (editContactId) {
        await updateDoc(doc(db, 'contacts', editContactId), {
          ...form,
          updatedAt: Timestamp.now(),
        });
        setContacts(contacts.map((c) => (c.id === editContactId ? { ...c, ...form } : c)));
        setEditContactId(null);
      } else {
        await addDoc(collection(db, 'contacts'), {
          ...form,
          createdAt: Timestamp.now(),
          uploadedBy: email || '',
        });
      }

      setForm({
        name: '',
        email: '',
        phone: '',
        address: '',
        company_name: '',
        date_of_birth: '',
        date_of_anniversary: '',
        categories: [],
        notes: '',
        assignedTo: [],
      });
      toast.success(editContactId ? 'Contact updated successfully!' : 'Contact added successfully!');
      fetchContacts();
    } catch (err) {
      console.error('Error adding/updating contact:', err);
      toast.error('Failed to add/update contact.');
    }
  };

  const handleEdit = (contact: Contact) => {
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
      company_name: contact.company_name,
      date_of_birth: contact.date_of_birth,
      date_of_anniversary: contact.date_of_anniversary,
      categories: contact.categories || [],
      notes: contact.notes || '',
      assignedTo: contact.assignedTo || [],
    });
    setEditContactId(contact.id);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteContact = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contacts', id));
      toast.success('Contact deleted successfully!');
      fetchContacts();
    } catch (err) {
      console.error('Error deleting contact:', err);
      toast.error('Failed to delete contact.');
    }
  };

  const removeCategory = (categoryToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.filter((cat) => cat !== categoryToRemove),
    }));
  };

  const addCategory = (categoryToAdd: string) => {
    if (!form.categories.includes(categoryToAdd)) {
      setForm((prev) => ({
        ...prev,
        categories: [...prev.categories, categoryToAdd],
      }));
    }
    setCategorySearchQuery('');
    setIsCategoryDropdownOpen(false);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Contacts</h1>
      <div ref={formRef} className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Add/Edit Contact</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Name', name: 'name', type: 'text', required: true },
            { label: 'Email', name: 'email', type: 'email', required: false },
            { label: 'Phone', name: 'phone', type: 'text', required: true },
            { label: 'Address', name: 'address', type: 'text' },
            { label: 'Company Name', name: 'company_name', type: 'text' },
            { label: 'Date of Birth', name: 'date_of_birth', type: 'date' },
            { label: 'Date of Anniversary', name: 'date_of_anniversary', type: 'date' },
          ].map((input) => (
            <div key={input.name}>
              <label className="block text-sm font-medium mb-1">
                {input.label}
                {input.required && ' *'}
              </label>
              <input
                type={input.type}
                name={input.name}
                value={(form as any)[input.name]}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
                required={input.required}
              />
            </div>
          ))}


          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2 sm:text-base">Categories</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.categories.map((cat) => (
                <div
                  key={cat}
                  className="bg-blue-100 text-blue-800 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center text-xs sm:text-sm"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => removeCategory(cat)}
                    className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
                  >
                    <X size={14} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="category-dropdown">
            <label className="block text-sm font-medium text-gray-700 mb-2 sm:text-base">Add Categories</label>
            <div className="relative w-full">
              <input
                type="text"
                className="w-full border px-3 py-2 rounded focus:outline-none"
                placeholder="Search or select categories..."
                value={categorySearchQuery}
                onChange={(e) => {
                  setCategorySearchQuery(e.target.value);
                  setIsCategoryDropdownOpen(true);
                }}
                onFocus={() => setIsCategoryDropdownOpen(true)}
              />
              {isCategoryDropdownOpen && (
                <div className="absolute z-10 w-full bg-white border rounded mt-1 max-h-40 overflow-y-auto shadow-lg">
                  {categories
                    .filter((cat) => cat.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                    .map((category) => (
                      <div
                        key={category}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => addCategory(category)}
                      >
                        {category}
                      </div>
                    ))}

                </div>
              )}
            </div>
          </div>

          <div ref={assignedToDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-2 sm:text-base">Assigned To</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.assignedTo.map((userId) => (
                <div
                  key={userId}
                  className="bg-blue-100 text-blue-800 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center text-xs sm:text-sm"
                >
                  <span>{getUserName(userId)}</span>
                  <button
                    type="button"
                    onClick={() => toggleAssignedTo(userId)}
                    className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
                  >
                    <X size={14} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="relative w-full">
              <input
                type="text"
                value={assignedToSearch}
                onChange={(e) => setAssignedToSearch(e.target.value)}
                onFocus={() => setIsAssignedToDropdownOpen(true)}
                placeholder="Search or select users..."
                className="w-full border px-3 py-2 rounded focus:outline-none"
              />
              {isAssignedToDropdownOpen && (
                <div className="absolute z-10 w-full bg-white border rounded mt-1 max-h-40 overflow-y-auto shadow-lg">
                  {users
                    .filter(user =>
                      (user.name.toLowerCase().includes(assignedToSearch.toLowerCase()) ||
                        user.email.toLowerCase().includes(assignedToSearch.toLowerCase())) &&
                      !form.assignedTo.includes(user.id)
                    )
                    .map(user => (
                      <div
                        key={user.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => toggleAssignedTo(user.id)}
                      >
                        {user.name} ({user.email})
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              rows={3}
              placeholder="Optional notes..."
            />
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {editContactId ? 'Update Contact' : 'Add Contact'}
          </button>
          {editContactId && (
            <button
              type="button"
              onClick={() => {
                setForm({
                  name: '',
                  email: '',
                  phone: '',
                  address: '',
                  company_name: '',
                  date_of_birth: '',
                  date_of_anniversary: '',
                  categories: [],
                  notes: '',
                  assignedTo: [],
                });
                setEditContactId(null);
              }}
              className="ml-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">All Contacts</h2>
        {loading ? (
          <p>Loading...</p>
        ) : contacts.length === 0 ? (
          <p>No contacts available.</p>
        ) : (
          <ul className="space-y-4">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                id={contact.id} // Add ID for scrolling
                className="border-b pb-3"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="space-y-1">
                    <p><strong>Name:</strong> {contact.name}</p>
                    <p><strong>Email:</strong> {contact.email}</p>
                    <p><strong>Phone:</strong> {contact.phone}</p>
                    <p><strong>Address:</strong> {contact.address}</p>
                    <p><strong>Company:</strong> {contact.company_name}</p>
                    <p><strong>DOB:</strong> {contact.date_of_birth}</p>
                    <p><strong>Anniversary:</strong> {contact.date_of_anniversary}</p>
                    <p><strong>Nearest Railway Station:</strong> {contact.railwayStation || 'Not specified'}</p>
                    <p><strong>Categories:</strong> {contact.categories?.join(', ') || 'None'}</p>
                    <p><strong>Assigned To:</strong> {contact.assignedTo.length > 0 ? contact.assignedTo.map(id => getUserName(id)).join(', ') : 'None'}</p>
                    <p><strong>Created By:</strong> {contact.uploadedBy || 'Unknown'}</p>
                    {contact.notes && <p><strong>Notes:</strong> {contact.notes}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-2 sm:mt-0">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="p-2 text-gray-400 hover:text-blue-500 rounded-full hover:bg-blue-50 transition-colors"
                        title="Edit Contact"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => deleteContact(contact.id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                        title="Delete Contact"
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="flex space-x-2">
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50 transition-colors"
                          title="Call Contact"
                        >
                          <Phone size={18} />
                        </a>
                        <a
                          href={`https://wa.me/${contact.phone}?text=Hello%20${encodeURIComponent(contact.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-green-600 hover:text-green-800 rounded-full hover:bg-green-50 transition-colors"
                          title="Message on WhatsApp"
                        >
                          <MessageSquareText size={18} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Contacts;