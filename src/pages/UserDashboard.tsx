import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
  addDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Phone, MessageSquareText, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

// Define TypeScript interfaces
interface User {
  id: string;
  email: string;
  phone: string;
  name?: string;
  [key: string]: any;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company_name: string;
  date_of_birth: string;
  date_of_anniversary: string;
  categories: string[];
  [key: string]: any;
}


interface TimeLog {
  date: string;
  minutes: number;
  userId?: string;
}

interface LoginTime {
  userId: string;
  timestamp: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  startDate: string;
  expectedMinutes: number;
  repeatDate?: string;
  assignedUserId: string;
  referenceContactId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByEmail: string;
  assignedById?: string; // Add this field
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority?: 'low' | 'medium' | 'high';
  isPrivate: boolean;
  links?: string;
  timeLogs?: TimeLog[];
  loginTimes?: LoginTime[];
}

interface Comment {
  id: string;
  taskId: string;
  userId: string;
  comment: string;
  createdAt: Timestamp;
}

export const UserDashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeInputs, setTimeInputs] = useState<{ [taskId: string]: string }>({});
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const email = localStorage.getItem('userEmail');
  const name = localStorage.getItem('name');
  const today = new Date().toISOString().split('T')[0];

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
        userId: userId!,
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

  const getUserPhone = (id: string): (string | null)[] => {
    if (!id) return [];
    const userIds = id.split(',').filter(uid => uid.trim());
    return userIds
      .map(uid => {
        const user = users.find(u => u.id === uid);
        return user?.phone || null;
      })
      .filter(phone => phone !== null);
  };


  const getContactName = (id: string): string => {
    if (!id) return 'None';
    const contactIds = id.split(',').filter(uid => uid.trim());
    if (contactIds.length === 0) return 'None';
    const names = contactIds
      .map(uid => {
        const contact = contacts.find(c => c.id === uid.trim());
        return contact?.name || 'Unknown';
      })
      .filter(name => name !== 'Unknown');
    return names.length > 0 ? names.join(', ') : 'None';
  };

  const getDueStatus = (dueDate: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(dueDate);
    const diffTime = taskDate.getTime() - today.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffTime < 0) return '#dc2626'; // red
    if (diffDays === 0) return '#d97706'; // amber
    if (diffDays <= 2) return '#2563eb'; // blue
    return '#4b5563'; // gray
  };

  const hasUserLoggedTime = (task: Task): boolean => {
    if (!task.timeLogs || !userId) return false;
    return task.timeLogs.some((log) => log.userId === userId);
  };

  const formatWhatsAppMessage = (task: Task): string => {
    const parts = [
      task.title || 'No title',
      task.description || 'No description',
      task.links || 'No link',
    ];
    return parts.join(' - ');
  };

  const formatExpectedTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  useEffect(() => {
    if (!email) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        const [userSnap, contactSnap, tasksSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'contacts')),
          getDocs(collection(db, 'tasks')),
        ]);

        setUsers(userSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as User)));
        setContacts(
          contactSnap.docs.map((doc) => {
            const data = doc.data();
            const categories = Array.isArray(data.categories)
              ? data.categories
              : data.category && typeof data.category === 'string'
                ? [data.category]
                : [];
            return {
              id: doc.id,
              name: data.name || '',
              email: data.email || '',
              phone: data.phone || '',
              address: data.address || '',
              company_name: data.company_name || '',
              date_of_birth: data.date_of_birth || '',
              date_of_anniversary: data.date_of_anniversary || '',
              categories,
            } as Contact;
          })
        );

        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', email));
        const userSnapResult = await getDocs(userQuery);

        if (userSnapResult.empty) throw new Error('User not found.');
        const currentUserId = userSnapResult.docs[0].id;
        setUserId(currentUserId);

        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);

        const allTasks = tasksSnap.docs
          .map((docSnap) => {
            const taskData = docSnap.data();
            const taskDate = taskData.dueDate ? new Date(taskData.dueDate) : null;
            if (taskDate) taskDate.setHours(0, 0, 0, 0);

            const isOverdue = taskData.dueDate && taskData.dueDate < today && taskData.status !== 'completed';
            const status = isOverdue ? 'overdue' : taskData.status || 'pending';

            return {
              id: docSnap.id,
              title: taskData.title || 'Untitled Task',
              description: taskData.description || '',
              dueDate: taskData.dueDate || today,
              startDate: taskData.startDate || today,
              expectedMinutes: taskData.expectedMinutes || 0,
              assignedUserId: taskData.assignedUserId || '',
              referenceContactId: taskData.referenceContactId || '',
              createdAt: taskData.createdAt || '',
              updatedAt: taskData.updatedAt || '',
              createdByEmail: taskData.createdByEmail || '',
              assignedById: taskData.assignedById || '', // Add this
              status,
              priority: taskData.priority || 'medium',
              isPrivate: taskData.isPrivate || false,
              links: taskData.links || '',
              timeLogs: taskData.timeLogs || [],
              loginTimes: taskData.loginTimes || [],
              repeatDate: taskData.repeatDate || '',
            } as Task;
          })
          .filter((task) => {
            const userIds = task.assignedUserId.split(',').filter((id) => id.trim());
            return userIds.includes(currentUserId) && (!task.isPrivate || task.createdByEmail === email);
          });

        setTasks(allTasks);
        setFilteredTasks(allTasks);
        setError('');

        await Promise.all(allTasks.map(task => fetchComments(task.id)));
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Failed to fetch tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [email, navigate, today]);

  const handleTimeInputChange = (taskId: string, value: string) => {
    setTimeInputs((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleSubmitTime = async (taskId: string) => {
    const minutes = parseFloat(timeInputs[taskId]);
    if (isNaN(minutes) || minutes <= 0 || !userId) return;

    const today = new Date().toISOString().split('T')[0];
    const task = tasks.find((t) => t.id === taskId);
    const alreadyLogged = task?.timeLogs?.some((log) => log.date === today && log.userId === userId);

    if (alreadyLogged) return;

    const taskRef = doc(db, 'tasks', taskId.split('-')[0]);
    const newTimeLog: TimeLog = { date: today, minutes, userId };

    try {
      await updateDoc(taskRef, { timeLogs: arrayUnion(newTimeLog) });
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, timeLogs: [...(task.timeLogs || []), newTimeLog] }
            : task
        )
      );
      setFilteredTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, timeLogs: [...(task.timeLogs || []), newTimeLog] }
            : task
        )
      );
      setTimeInputs((prev) => ({ ...prev, [taskId]: '' }));
    } catch (err) {
      console.error('Error updating time log:', err);
      setError('Failed to submit time');
    }
  };

  const validateStatus = (value: string): Task['status'] => {
    const validStatuses = ['pending', 'in_progress', 'completed', 'overdue'] as const;
    return validStatuses.includes(value as any) ? value as Task['status'] : 'pending';
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    const validStatus = validateStatus(status);
    if (!userId) return;

    try {
      const originalTaskId = taskId.split('-')[0];
      const taskRef = doc(db, 'tasks', originalTaskId);
      const updates: { status: Task['status']; loginTimes?: LoginTime[] } = { status: validStatus };

      if (validStatus === 'in_progress') {
        const newLoginTime: LoginTime = {
          userId,
          timestamp: new Date().toISOString(),
        };
        updates.loginTimes = arrayUnion(newLoginTime);
      }

      await updateDoc(taskRef, updates);

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
              ...task,
              status: validStatus,
              loginTimes:
                validStatus === 'in_progress'
                  ? [...(task.loginTimes || []), { userId, timestamp: new Date().toISOString() }]
                  : task.loginTimes,
            }
            : task
        )
      );
      setFilteredTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
              ...task,
              status: validStatus,
              loginTimes:
                validStatus === 'in_progress'
                  ? [...(task.loginTimes || []), { userId, timestamp: new Date().toISOString() }]
                  : task.loginTimes,
            }
            : task
        )
      );
    } catch (err) {
      console.error('Error updating task status:', err);
      setError('Failed to update task status');
    }
  };


if (loading) return <div className="p-6 text-center text-gray-500">Loading tasks...</div>;
if (error) return <div className="p-6 text-center text-red-600">{error}</div>;


  return (
  <div className="min-h-screen bg-gray-100 p-4">
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Hi, {name || 'User'}
        </h1>
      <h3 className="text-lg font-medium text-gray-600 mb-6">
          It always seems impossible until it's done.
        </h3>
      <div className="max-h-[700px] overflow-y-auto pr-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Tasks <span className="text-sm text-gray-500">({filteredTasks.length})</span>
            </h3>
          </div>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
            className="bg-white rounded-lg p-4 mb-4 shadow-sm border-l-4"
            style={{ borderLeftColor: getDueStatus(task.dueDate) }}
            >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {task.title}
                  </h4>
                <div className="text-sm text-gray-600 mb-2">
                    Due: {new Date(task.dueDate).toLocaleDateString()} | Start: {new Date(task.startDate).toLocaleDateString()} |{' '}
                    Expected Time: {formatExpectedTime(task.expectedMinutes)} |{' '}
                    Status: {task.status.charAt(0).toUpperCase() + task.status.slice(1)} |{' '}
                    Priority: {task.priority} |{' '}
                    Assigned to: {getUserName(task.assignedUserId)} |{' '}
                    Contact: {getContactName(task.referenceContactId || '')}
                  </div>
                <div className="text-sm text-gray-600">
                    Created by: {task.createdByEmail}
                  </div>
                </div>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mt-2 md:mt-0">
                  <select
                    value={task.status}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                  className="p-2 rounded-md border border-gray-300 cursor-pointer w-full md:w-auto"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Min"
                      value={timeInputs[task.id] || ''}
                      onChange={(e) => handleTimeInputChange(task.id, e.target.value)}
                    className="p-2 rounded-md border border-gray-300 w-full md:w-20"
                    />
                    <button
                      onClick={() => handleSubmitTime(task.id)}
                      disabled={hasUserLoggedTime(task)}
                    className={`p-2 rounded-md text-white border-none cursor-pointer transition-colors ${
                      hasUserLoggedTime(task) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    >
                      Log
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setExpandedTasks((prev) => {
                        const newSet = new Set(prev);
                      if (newSet.has(task.id)) newSet.delete(task.id);
                      else newSet.add(task.id);
                        return newSet;
                      });
                    }}
                  className="p-1 border-none bg-transparent text-blue-600 cursor-pointer transition-transform"
                  style={{ transform: expandedTasks.has(task.id) ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
              {expandedTasks.has(task.id) && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                    Description: {task.description || 'No description'}
                  </p>
                <p className="text-sm text-gray-600 mb-2">
                  Links: <a href={task.links || '#'} className="text-blue-600">{task.links || 'No link'}</a>
                  </p>
                  {task.referenceContactId && (
                  <div className="text-sm text-gray-600 mb-2">
                      Contact Phone:{' '}
                      {getUserPhone(task.referenceContactId).map((phone, index) => (
                        <span key={index}>
                          {phone && (
                          <span className="mr-2">
                            <a href={`tel:${phone}`} className="text-blue-600 mr-2">
                                <Phone size={14} />
                              </a>
                              <a
                                href={`https://wa.me/${phone}?text=${encodeURIComponent(formatWhatsAppMessage(task))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              className="text-green-600 mr-2"
                              >
                                <MessageSquareText size={14} />
                              </a>
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  <div>
                    <input
                      type="text"
                      value={newComments[task.id] || ''}
                      onChange={(e) => setNewComments((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      placeholder="Add a comment..."
                    className="w-full p-2 rounded-md border border-gray-300 mb-2"
                    />
                    <button
                      onClick={() => handleAddComment(task.id)}
                    className="p-2 rounded-md bg-blue-600 text-white border-none cursor-pointer hover:bg-blue-700 transition-colors"
                    >
                      Add Comment
                    </button>
                  </div>
                  {comments[task.id] && comments[task.id].length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">Comments</h5>
                      {comments[task.id].map((comment) => (
                        <div
                          key={comment.id}
                        className="bg-gray-100 p-2 rounded-md mb-2"
                        >
                        <p className="text-sm text-gray-600">
                            {comment.comment} -{' '}
                            {getUserName(comment.userId) || 'Unknown User'} on{' '}
                            {comment.createdAt.toDate().toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;