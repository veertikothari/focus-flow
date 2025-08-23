import { useState, useEffect, useRef } from 'react';
import { Trash2, Edit, Plus, Phone, MessageSquareText, Circle, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, addDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  [key: string]: any;
}
type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company_name: string;
  date_of_birth: string; // YYYY-MM-DD
  date_of_anniversary: string; // YYYY-MM-DD
  categories: string[];
  notes?: string;
  createdAt: Timestamp;
  uploadedBy: string;
  assignedTo: string[];
};

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assignedUserId: string;
  assignedById: string;
  expectedMinutes: number;
  referenceContactId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByEmail: string;
  status: string;
  priority?: 'low' | 'medium' | 'high';
  isPrivate: boolean;
  links?: string;
  startDate: string;
}

interface TaskFormData {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  assignedUserId: string;
  assignedById: string;
  expectedMinutes: number;
  referenceContactId: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | '';
  isPrivate: boolean;
  links: string;
  startDate: string;
  startTime: string;
}

interface NewContactForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  company_name: string;
  date_of_birth: string;
  date_of_anniversary: string;
  categories: string[];
}

interface Comment {
  id: string;
  taskId: string;
  userId: string;
  comment: string;
  createdAt: Timestamp;
}

export function AdminTasks() {
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [isEditingTask, setIsEditingTask] = useState<string | null>(null);
  const [showNewContactForm, setShowNewContactForm] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const formRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    assignedUserId: '',
    assignedById: '',
    referenceContactId: '',
    priority: '',
    status: 'pending',
    isPrivate: false,
    links: '',
    startDate: '',
    startTime: '',
    expectedMinutes: 0,
  });
  const [newContactForm, setNewContactForm] = useState<NewContactForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    company_name: '',
    date_of_birth: '',
    date_of_anniversary: '',
    categories: [],
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<string>('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [taskUserSearch, setTaskUserSearch] = useState<string>('');
  const [contactSearch, setContactSearch] = useState<string>('');
  const [prioritySearch, setPrioritySearch] = useState<string>('');
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const email = localStorage.getItem('userEmail');
  const userId = users.find(u => u.email === email)?.id || '';
  // Dropdown refs
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [showTaskUserDropdown, setShowTaskUserDropdown] = useState(false);
  const taskUserDropdownRef = useRef<HTMLDivElement>(null);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);

  const getCurrentDate = (): string => new Date().toISOString().split('T')[0];
  const getCurrentTime = (): string => new Date().toTimeString().slice(0, 5);
  const formatDateTime = (date: string, time: string): string => {
    return new Date(`${date}T${time}`).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  const today = new Date().toISOString().split('T')[0];

  const getOverdueTime = (dueDate: string): string => {
    const now = new Date();
    const taskDue = new Date(dueDate);
    const diffMs = now.getTime() - taskDue.getTime();

    if (diffMs <= 0) return '';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let timeString = '';
    if (days > 0) timeString += `${days}d `;
    if (hours > 0 || days > 0) timeString += `${hours}h `;
    timeString += `${minutes}m`;

    return ` (Overdue by: ${timeString.trim()})`;
  };

  const fetchCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'contacts'));
      const allCategories = snapshot.docs
        .flatMap((doc) => {
          if (!doc.exists()) return [];
          const data = doc.data();
          return Array.isArray(data.categories) ? data.categories : data.category ? [data.category] : [];
        })
        .filter((cat): cat is string => cat !== undefined && cat.trim() !== '');
      const uniqueCategories = [...new Set(allCategories)];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const formatWhatsAppMessage = (task: Task): string => {
    const parts = [
      task.title || 'No title',
      task.description || 'No description',
      task.links || 'No link',
    ];
    return parts.join(' - ');
  };
  const fetchComments = async (taskId: string) => {
    try {
      const commentsQuery = query(collection(db, 'task_comments'), where('taskId', '==', taskId));
      const snapshot = await getDocs(commentsQuery);
      const taskComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Comment));
      setComments(prev => ({ ...prev, [taskId]: taskComments }));
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast.error('Failed to load comments.');
    }
  };
  const handleAddComment = async (taskId: string) => {
    const comment = newComments[taskId]?.trim();
    if (!comment || !userId) return;

    try {
      const newCommentDoc = {
        taskId,
        userId,
        comment,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, 'task_comments'), newCommentDoc);
      const newCommentWithId = { id: docRef.id, ...newCommentDoc };
      setComments(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), newCommentWithId],
      }));
      setNewComments(prev => ({ ...prev, [taskId]: '' }));
      toast.success('Comment added successfully.');
    } catch (err) {
      console.error('Error adding comment:', err);
      toast.error('Failed to add comment.');
    }
  };
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [userSnap, contactSnap, taskSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'contacts')),
          getDocs(collection(db, 'tasks')),
        ]);

        // Set users and contacts
        const fetchedUsers = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(fetchedUsers);
        setContacts(
          contactSnap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || '',
              email: data.email || '',
              phone: data.phone || '',
              address: data.address || '',
              company_name: data.company_name || '',
              date_of_birth: data.date_of_birth || '',
              date_of_anniversary: data.date_of_anniversary || '',
              categories: Array.isArray(data.categories) ? data.categories : data.category ? [data.category] : [],
              createdAt: data.createdAt,
              uploadedBy: data.uploadedBy || '',
              assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [],
            } as Contact;
          })
        );

        const validTasks: Task[] = [];
        const baseTasks = taskSnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          assignedUserId: docSnap.data().assignedUserId || '',
          isPrivate: docSnap.data().isPrivate || false,
          links: docSnap.data().links || '',
          assignedById: docSnap.data().assignedById || '',
          startDate: docSnap.data().startDate || '',
          expectedMinutes: docSnap.data().expectedMinutes || 0,
          status: docSnap.data().status || 'pending',
        } as Task));

        for (const task of baseTasks) {
          if (task.status === 'completed' && task.updatedAt) {
            const updatedAt = new Date(task.updatedAt).getTime();
            if (Date.now() - updatedAt > 30 * 24 * 60 * 60 * 1000) {
              await deleteDoc(doc(db, 'tasks', task.id));
              continue;
            }
          }

          validTasks.push(task);
        }

        setTasks(validTasks);
        await fetchCategories();
        await Promise.all(validTasks.map(task => fetchComments(task.id)));
        setLoading(false);
      } catch (err) {
        setLoading(false);
        console.error('Error in fetchData:', err);
      }
    };

    fetchData();
  }, [email]); // Only depend on email to avoid unnecessary reruns

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
      if (type === 'checkbox') {
        return { ...prev, [name]: (e.target as HTMLInputElement).checked };
      }
      if ((name === 'dueDate' || name === 'startDate') && value < today) {
        return prev; // Prevent setting older dates
      }
      return { ...prev, [name]: value };
    });
  };

  const handleNewContactInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewContactForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCategory = (category: string) => {
    if (!newContactForm.categories.includes(category)) {
      setNewContactForm(prev => ({
        ...prev,
        categories: [...prev.categories, category],
      }));
    }
    setCategorySearchQuery('');
    setIsCategoryDropdownOpen(false);
  };

  const handleRemoveCategory = (category: string) => {
    setNewContactForm(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat !== category),
    }));
  };

  const handleAddNewCategory = () => {
    if (newCategory.trim()) {
      if (!categories.includes(newCategory)) {
        setCategories(prev => [...prev, newCategory]);
      }
      if (!newContactForm.categories.includes(newCategory)) {
        setNewContactForm(prev => ({
          ...prev,
          categories: [...prev.categories, newCategory],
        }));
      }
      setShowAddCategory(false);
      setNewCategory('');
    }
  };

  const handleAddTask = async () => {
    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', email));
      const userSnap = await getDocs(userQuery);
      let defaultAssignedById = '';
      if (!userSnap.empty) {
        defaultAssignedById = userSnap.docs[0].id;
      }

      setIsAddingTask(true);
      setIsEditingTask(null);
      setShowNewContactForm(false);
      setFormData({
        title: '',
        description: '',
        dueDate: getCurrentDate(),
        dueTime: getCurrentTime(),
        assignedUserId: '',
        assignedById: defaultAssignedById,
        referenceContactId: '',
        priority: 'medium',
        status: 'pending',
        isPrivate: false,
        links: '',
        startDate: getCurrentDate(),
        startTime: getCurrentTime(),
        expectedMinutes: 0,
      });
      setNewContactForm({
        name: '',
        email: '',
        phone: '',
        address: '',
        company_name: '',
        date_of_birth: '',
        date_of_anniversary: '',
        categories: [],
      });
      setTaskUserSearch('');
      setContactSearch('');
      setPrioritySearch('');
    } catch (err) {
      console.error('Failed to fetch user ID for assignedById:', err);
    }
  };

  const handleEditTask = (task: Task) => {
    setIsEditingTask(task.id);
    setIsAddingTask(false);
    setShowNewContactForm(false);
    setFormData({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate.split('T')[0],
      dueTime: task.dueDate.split('T')[1]?.slice(0, 5) || getCurrentTime(),
      assignedUserId: task.assignedUserId || '',
      assignedById: task.assignedById || '',
      referenceContactId: task.referenceContactId || '',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      isPrivate: task.isPrivate || false,
      links: task.links || '',
      startDate: task.startDate?.split('T')[0] || getCurrentDate(),
      startTime: task.startDate?.split('T')[1]?.slice(0, 5) || getCurrentTime(),
      expectedMinutes: task.expectedMinutes || 0,
    });
    setTaskUserSearch('');
    setContactSearch('');
    setPrioritySearch('');
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  const handleCancel = () => {
    setIsAddingTask(false);
    setIsEditingTask(null);
    setShowNewContactForm(false);
    setFormData({
      title: '',
      description: '',
      dueDate: '',
      dueTime: '',
      assignedUserId: '',
      assignedById: '',
      referenceContactId: '',
      priority: '',
      status: '',
      isPrivate: false,
      links: '',
      startDate: '',
      startTime: '',
      expectedMinutes: 0,
    });
    setNewContactForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      company_name: '',
      date_of_birth: '',
      date_of_anniversary: '',
      categories: [],
    });
    setTaskUserSearch('');
    setContactSearch('');
    setPrioritySearch('');
    setCategorySearchQuery('');
    setShowAddCategory(false);
    setNewCategory('');
    setIsCategoryDropdownOpen(false);
  };

  const handleAddNewContact = async () => {
    try {
      if (!newContactForm.name || !newContactForm.phone) return;
      const newRef = doc(collection(db, 'contacts'));
      await setDoc(newRef, {
        ...newContactForm,
        createdAt: new Date().toISOString(),
      });
      const newContact = { id: newRef.id, ...newContactForm } as Contact;
      setContacts(prev => [...prev, newContact]);
      setFormData(prev => {
        const currentIds = prev.referenceContactId ? prev.referenceContactId.split(',').filter(id => id.trim()) : [];
        const newIds = [...currentIds, newRef.id];
        return { ...prev, referenceContactId: newIds.join(',') };
      });
      setNewContactForm({
        name: '',
        email: '',
        phone: '',
        address: '',
        company_name: '',
        date_of_birth: '',
        date_of_anniversary: '',
        categories: [],
      });
      setShowNewContactForm(false);
      setCategorySearchQuery('');
      setShowAddCategory(false);
      setNewCategory('');
      setIsCategoryDropdownOpen(false);
    } catch (err) {
      console.error('Failed to add contact', err);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.title || !formData.dueDate || !formData.assignedUserId) {
        toast.error('Title, due date, and assigned user are required.');
        return;
      }
      if (formData.dueDate < today || formData.startDate < today) {
        toast.error('Due date and start date cannot be older than today.');
        return;
      }

      const dueTime = formData.dueTime || '00:00';
      const startTime = formData.startTime || dueTime;
      const taskData: Omit<Task, 'id'> = {
        title: formData.title,
        description: formData.description,
        dueDate: `${formData.dueDate}T${dueTime}`,
        startDate: `${formData.startDate}T${startTime}`,
        assignedUserId: formData.assignedUserId,
        assignedById: formData.assignedById,
        expectedMinutes: Number(formData.expectedMinutes) || 0,
        referenceContactId: formData.referenceContactId || '',
        status: formData.status || 'pending',
        priority: formData.priority || 'medium',
        isPrivate: formData.isPrivate,
        links: formData.links || '',
        createdByEmail: email || '',
        updatedAt: new Date().toISOString(),
      };

      let newTaskId: string | null = null;

      if (isEditingTask) {
        await updateDoc(doc(db, 'tasks', isEditingTask), taskData);
        setTasks(prev =>
          prev.map(task =>
            task.id === isEditingTask ? { ...taskData, id: isEditingTask } : task
          )
        );
        toast.success('Task updated successfully.');
      } else {
        const newRef = doc(collection(db, 'tasks'));
        const newTask = {
          ...taskData,
          createdAt: new Date().toISOString(),
        };
        await setDoc(newRef, newTask);
        newTaskId = newRef.id;
        setTasks(prev => [...prev, { ...newTask, id: newRef.id }]);

        if (!isEditingTask && newTaskId) {
          const assignedUserIds = formData.assignedUserId.split(',').filter(id => id.trim());
          assignedUserIds.forEach(userId => {
            const user = users.find(u => u.id === userId);
          });
        }
        toast.success('Task created successfully.');
      }
      handleCancel();
    } catch (err) {
      console.error('Failed to submit task', err);
      toast.error('Failed to submit task.');
    }
  };

  const getUserName = (id: string): string => {
    if (!id) return 'None';
    const userIds = id.split(',').filter(uid => uid.trim());
    if (userIds.length === 0) return 'None';
    const names = userIds
      .map(uid => {
        const user = users.find(u => u.id === uid);
        return user?.name || 'Unknown';
      })
      .filter(name => name !== 'Unknown');
    return names.length > 0 ? names.join(', ') : 'None';
  };

  const getUserPhone = (id: string): string[] | null => {
    if (!id) return null;
    const userIds = id.split(',').filter(uid => uid.trim());
    const phones = userIds
      .map(uid => {
        const user = users.find(u => u.id === uid);
        return user?.phone || null;
      })
      .filter(phone => phone !== null);
    return phones.length > 0 ? phones as string[] : null;
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const handleTaskUserSelect = (userId: string) => {
    setFormData(prev => {
      const currentIds = prev.assignedUserId ? prev.assignedUserId.split(',').filter(id => id.trim()) : [];
      let newIds: string[];
      if (currentIds.includes(userId)) {
        newIds = currentIds.filter(id => id !== userId);
      } else {
        newIds = [...currentIds, userId];
      }
      return {
        ...prev,
        assignedUserId: newIds.join(','),
      };
    });
    setTaskUserSearch('');
    setShowTaskUserDropdown(false);
  };

  const handleContactSelect = (contactId: string) => {
    setFormData(prev => {
      const currentIds = prev.referenceContactId ? prev.referenceContactId.split(',').filter(id => id.trim()) : [];
      let newIds: string[];
      if (contactId === '') {
        newIds = [];
      } else if (currentIds.includes(contactId)) {
        newIds = currentIds.filter(id => id !== contactId);
      } else {
        newIds = [...currentIds, contactId];
      }
      return {
        ...prev,
        referenceContactId: newIds.join(','),
      };
    });
    setShowContactDropdown(false);
    setContactSearch('');
  };

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  const handlePrioritySelect = (priority: string) => {
    setFormData(prev => ({ ...prev, priority: priority as 'low' | 'medium' | 'high' }));
    setShowPriorityDropdown(false);
    setPrioritySearch('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (taskUserDropdownRef.current && !taskUserDropdownRef.current.contains(event.target as Node)) {
        setShowTaskUserDropdown(false);
      }
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-4">
      {/* Add Task Button */}
      <div className="mb-4">
        <button
          onClick={handleAddTask}
          className="bg-blue-600 text-white px-3 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors text-sm sm:text-base md:text-lg"
        >
          <Plus size={16} />
          Add a task
        </button>
      </div>

      {/* Task Form */}
      {(isAddingTask || isEditingTask) && (
        <div ref={formRef} className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <Circle size={20} className="text-gray-400" />
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Title"
              className="flex-1 border-b border-gray-300 p-2 bg-transparent focus:outline-none focus:border-blue-500 text-sm sm:text-base md:text-lg"
              autoFocus
            />
          </div>

          <div className="space-y-4">
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Allow default behavior (new line), but prevent any form submission
                  e.stopPropagation();
                }
              }}
              placeholder="Description + References"
              className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
              rows={3}
            />
            <input
              type="url"
              name="links"
              value={formData.links}
              onChange={handleInputChange}
              placeholder="Add a link (e.g., https://example.com)"
              className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm sm:text-base md:text-lg text-gray-700">Due Date</label>
                    <input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm sm:text-base md:text-lg text-gray-700">Due Time</label>
                    <input
                      type="time"
                      name="dueTime"
                      value={formData.dueTime}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm sm:text-base md:text-lg text-gray-700">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm sm:text-base md:text-lg text-gray-700">Start Time</label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm sm:text-base md:text-lg text-gray-700">Alloted Time (Minutes)</label>
                <input
                  type="number"
                  name="expectedMinutes"
                  value={formData.expectedMinutes}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                />
              </div>
              <div ref={taskUserDropdownRef}>
                <label className="block text-sm sm:text-base md:text-lg text-gray-700">Assign to *</label>
                <div className="relative">
                  <div className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg">
                    <div className="flex flex-wrap gap-1 min-h-[1.5rem]">
                      {formData.assignedUserId
                        ?.split(',')
                        .filter(id => id.trim())
                        .map(userId => {
                          const user = users.find(u => u.id === userId);
                          return user ? (
                            <span
                              key={userId}
                              className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1 text-xs sm:text-sm"
                            >
                              {user.name}
                              <button
                                type="button"
                                onClick={() => handleTaskUserSelect(userId)}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ) : null;
                        })}
                      <input
                        type="text"
                        value={taskUserSearch}
                        onChange={(e) => setTaskUserSearch(e.target.value)}
                        onFocus={() => setShowTaskUserDropdown(true)}
                        placeholder={formData.assignedUserId ? '' : 'Search users...'}
                        className="flex-1 border-none focus:outline-none text-sm sm:text-base md:text-lg bg-transparent"
                      />
                    </div>
                  </div>
                  {showTaskUserDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-auto">
                      {users
                        .filter(user => {
                          const matchesSearch =
                            user.name.toLowerCase().includes(taskUserSearch.toLowerCase()) ||
                            user.email.toLowerCase().includes(taskUserSearch.toLowerCase());
                          return matchesSearch;
                        })
                        .map(user => (
                          <div
                            key={user.id}
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleTaskUserSelect(user.id)}
                          >
                            {user.name} ({user.email})
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <div ref={priorityDropdownRef}>
                <label className="block text-sm sm:text-base md:text-lg text-gray-700">Priority</label>
                <div className="relative">
                  <input
                    type="text"
                    value={prioritySearch || formData.priority}
                    onChange={(e) => setPrioritySearch(e.target.value)}
                    onFocus={() => setShowPriorityDropdown(true)}
                    placeholder="Select priority"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  {showPriorityDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-auto">
                      {priorities
                        .filter(p => p.label.toLowerCase().includes(prioritySearch.toLowerCase()))
                        .map(p => (
                          <div
                            key={p.value}
                            className={`p-2 hover:bg-gray-100 cursor-pointer ${formData.priority === p.value ? 'bg-blue-100' : ''
                              }`}
                            onClick={() => handlePrioritySelect(p.value)}
                          >
                            {p.label}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <div ref={contactDropdownRef}>
                <label className="block text-sm sm:text-base md:text-lg text-gray-700">Contacts</label>
                <div className="relative">
                  <div className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg">
                    <div className="flex flex-wrap gap-1 min-h-[1.5rem]">
                      {formData.referenceContactId
                        ?.split(',')
                        .filter(id => id.trim())
                        .map(contactId => {
                          const contact = contacts.find(c => c.id === contactId);
                          return contact ? (
                            <span
                              key={contactId}
                              className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1 text-xs sm:text-sm"
                            >
                              {contact.name}
                              <button
                                type="button"
                                onClick={() => handleContactSelect(contactId)}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ) : null;
                        })}
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        onFocus={() => setShowContactDropdown(true)}
                        placeholder={formData.referenceContactId ? '' : 'Search contacts...'}
                        className="flex-1 border-none focus:outline-none text-sm sm:text-base md:text-lg bg-transparent"
                      />
                    </div>
                  </div>
                  {showContactDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-auto">
                      {contacts
                        .filter(contact =>
                          contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                          contact.phone.toLowerCase().includes(contactSearch.toLowerCase())
                        )
                        .map(contact => (
                          <div
                            key={contact.id}
                            className={`p-2 hover:bg-gray-100 cursor-pointer ${formData.referenceContactId?.split(',').includes(contact.id) ? 'bg-blue-100' : ''
                              }`}
                            onClick={() => handleContactSelect(contact.id)}
                          >
                            {contact.name} ({contact.phone || 'No phone'})
                          </div>
                        ))}
                      <div
                        className={`p-2 hover:bg-gray-100 cursor-pointer ${formData.referenceContactId === '' ? 'bg-blue-100' : ''
                          }`}
                        onClick={() => handleContactSelect('')}
                      >
                        None
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowNewContactForm(!showNewContactForm)}
                  className="text-blue-600 hover:text-blue-800 mt-2"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div>
                <label className="block text-sm sm:text-base md:text-lg text-gray-700">Private Task</label>
                <input
                  type="checkbox"
                  name="isPrivate"
                  checked={formData.isPrivate}
                  onChange={handleInputChange}
                  className="mt-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-600">Hide from admin view</span>
              </div>
              {showNewContactForm && (
                <div className="col-span-2 space-y-2 p-4 bg-white rounded-lg shadow">
                  <input
                    type="text"
                    name="name"
                    value={newContactForm.name}
                    onChange={handleNewContactInputChange}
                    placeholder="Name *"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  <input
                    type="email"
                    name="email"
                    value={newContactForm.email}
                    onChange={handleNewContactInputChange}
                    placeholder="Email *"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  <input
                    type="tel"
                    name="phone"
                    value={newContactForm.phone}
                    onChange={handleNewContactInputChange}
                    placeholder="Phone *"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  <input
                    type="text"
                    name="address"
                    value={newContactForm.address}
                    onChange={handleNewContactInputChange}
                    placeholder="Address"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  <input
                    type="text"
                    name="company_name"
                    value={newContactForm.company_name}
                    onChange={handleNewContactInputChange}
                    placeholder="Company"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  <label className="block text-sm font-medium mb-1">Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={newContactForm.date_of_birth}
                    onChange={handleNewContactInputChange}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  <label className="block text-sm font-medium mb-1">Date of Anniversary</label>
                  <input
                    type="date"
                    name="date_of_anniversary"
                    value={newContactForm.date_of_anniversary}
                    onChange={handleNewContactInputChange}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
                  />
                  <div className="w-full" ref={categoryDropdownRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-2 sm:text-base">Categories</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {newContactForm.categories.map((cat) => (
                        <div
                          key={cat}
                          className="bg-blue-100 text-blue-800 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center text-xs sm:text-sm"
                        >
                          <span>{cat}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat)}
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
                        className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm sm:text-base md:text-lg"
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
                                onClick={() => handleAddCategory(category)}
                              >
                                {category}
                              </div>
                            ))}
                          <div
                            className="p-2 hover:bg-gray-100 cursor-pointer text-blue-600"
                            onClick={() => {
                              setShowAddCategory(true);
                              setIsCategoryDropdownOpen(false);
                            }}
                          >
                            + Add New Category
                          </div>
                        </div>
                      )}
                    </div>
                    {showAddCategory && (
                      <div className="mt-2 p-2 bg-white border rounded shadow-lg">
                        <input
                          type="text"
                          placeholder="Enter new category"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full border px-2 py-1 rounded mb-2"
                        />
                        <button
                          type="button"
                          onClick={handleAddNewCategory}
                          className="px-2 py-1 bg-blue-600 text-white rounded mr-2"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddCategory(false)}
                          className="px-2 py-1 border rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNewContact}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm sm:text-base md:text-lg"
                    >
                      Save Contact
                    </button>
                    <button
                      onClick={() => setShowNewContactForm(false)}
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm sm:text-base md:text-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSubmit}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm sm:text-base md:text-lg"
              >
                {isEditingTask ? 'Update' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 transition-colors text-sm sm:text-base md:text-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="mt-2 text-gray-500 text-sm sm:text-base md:text-lg">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <p>No tasks available.</p>
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Tasks <span className="text-sm text-gray-500">({tasks.length})</span>
          </h3>
          <ul className="space-y-4">
            {tasks.map(task => {
              const isAuthorized = userId && (task.assignedUserId.split(',').some(uid => uid === userId) || userId === task.assignedById);
              return (
                <li key={task.id} className="bg-white p-4 rounded-lg shadow hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Circle size={16} className="text-gray-400" />
                        <h3
                          className={`font-medium text-sm sm:text-base md:text-lg ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'
                            }`}
                        >
                          {task.title}
                        </h3>
                      </div>
                      {task.description && (
                        <p
                          className={`text-xs sm:text-sm md:text-base mb-2 ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-600'
                            }`}
                          style={{ whiteSpace: 'pre-wrap' }}
                        >
                          {task.description}
                        </p>
                      )}
                      {task.links && (
                        <p className="text-xs sm:text-sm md:text-base mb-2 text-blue-600 hover:underline">
                          <a
                            href={task.links.startsWith('http://') || task.links.startsWith('https://') ? task.links : `https://${task.links}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {task.links}
                          </a>
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm md:text-base">
                        <span className="font-medium text-gray-500">
                          Due: {formatDateTime(task.dueDate.split('T')[0], task.dueDate.split('T')[1]?.slice(0, 5) || '00:00')}
                          {task.status !== 'completed' && getOverdueTime(task.dueDate)}
                        </span>
                        <span className="font-medium text-gray-500">
                          Start: {formatDateTime(task.startDate.split('T')[0], task.startDate.split('T')[1]?.slice(0, 5) || '00:00')}
                        </span>
                        <span className="text-gray-600">
                          Expected Time: {task.expectedMinutes} minutes
                        </span>
                        <span className="text-gray-600">
                          Assigned By: {task.createdByEmail ? getUserName(task.assignedById) : 'None'}
                          {task.assignedById && getUserPhone(task.assignedById) && (
                            <div className="inline-flex ml-1 gap-1">
                              {getUserPhone(task.assignedById)!.map((phone, index) => (
                                <span key={index} className="inline-flex gap-1">
                                  <a
                                    href={`tel:${phone}`}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    <Phone size={12} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${phone}?text=${encodeURIComponent('Regarding task: ' + formatWhatsAppMessage(task))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-800"
                                  >
                                    <MessageSquareText size={12} />
                                  </a>
                                </span>
                              ))}
                            </div>
                          )}
                        </span>
                        <span className="text-gray-600">
                          {task.assignedUserId
                            ? (
                              <>
                                Assigned to: {task.assignedUserId.split(',').map((userId, index) => (
                                  <span key={index} className="mr-2 inline-flex items-center">
                                    {index > 0 && ', '} {getUserName(userId)}
                                    {getUserPhone(userId) && (
                                      <div className="inline-flex ml-1 gap-1">
                                        {getUserPhone(userId)!.map((phone, phoneIndex) => (
                                          <span key={phoneIndex} className="inline-flex gap-1">
                                            <a
                                              href={`tel:${phone}`}
                                              className="text-blue-600 hover:text-blue-800"
                                            >
                                              <Phone size={12} />
                                            </a>
                                            <a
                                              href={`https://wa.me/${phone}?text=${encodeURIComponent('Regarding task: ' + formatWhatsAppMessage(task))}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-green-600 hover:text-green-800"
                                            >
                                              <MessageSquareText size={12} />
                                            </a>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </span>
                                ))}
                              </>
                            )
                            : 'None'}
                        </span>
                        {task.priority && (
                          <span className="text-gray-600">
                            Priority:{' '}
                            <span
                              className={
                                task.priority === 'high'
                                  ? 'text-red-500'
                                  : task.priority === 'medium'
                                    ? 'text-yellow-500'
                                    : 'text-green-500'
                              }
                            >
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          </span>
                        )}
                        {task.referenceContactId && (
                          <span className="text-gray-600">
                            Contacts:{' '}
                            {task.referenceContactId.split(',').map((contactId, index) => {
                              const contact = contacts.find(c => c.id === contactId);
                              return contact ? (
                                <span key={index} className="mr-2 inline-flex items-center">
                                  {index > 0 && ', '}
                                  {contact.name}
                                  {contact.phone && (
                                    <div className="inline-flex ml-1 gap-1">
                                      <a
                                        href={`tel:${contact.phone}`}
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        <Phone size={12} />
                                      </a>
                                      <a
                                        href={`https://wa.me/${contact.phone}?text=${encodeURIComponent(
                                          'Regarding task: ' + formatWhatsAppMessage(task)
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-600 hover:text-green-800"
                                      >
                                        <MessageSquareText size={12} />
                                      </a>
                                    </div>
                                  )}
                                </span>
                              ) : null;
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleEditTask(task)}
                        className="p-2 text-gray-400 hover:text-blue-500 rounded-full hover:bg-blue-50 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {isAuthorized && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Comments</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                        {comments[task.id] && comments[task.id].length > 0 ? comments[task.id].sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()).map(comment => {
                          const commenter = users.find(u => u.id === comment.userId);
                          return (
                            <div key={comment.id} className="p-2 bg-white rounded shadow">
                              <span className="font-semibold">{commenter ? commenter.name : 'Unknown'}:</span> {comment.comment}
                            </div>
                          );
                        }) : <p className="text-xs text-gray-500">No comments yet.</p>}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newComments[task.id] || ''}
                          onChange={(e) => setNewComments(prev => ({ ...prev, [task.id]: e.target.value }))}
                          placeholder="Add a comment..."
                          className="flex-1 p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        />
                        <button
                          onClick={() => handleAddComment(task.id)}
                          className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-sm"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AdminTasks;