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

export const Dashboard = () => {
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

  const getContactDetails = (id: string): { name: string; phone: string | null } => {
    const contact = contacts.find((c) => c.id === id);
    return contact
      ? { name: contact.name || 'No name', phone: contact.phone || null }
      : { name: 'None', phone: null };
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

  const getContactPhone = (id: string): string | null => getContactDetails(id).phone;

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

  const getStartStatus = (startDate: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(startDate);
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

  const handleAddTask = () => navigate('/tasks');

  if (loading) return <div style={{ padding: '24px', color: '#6b7280', textAlign: 'center' }}>Loading tasks...</div>;
  if (error) return <div style={{ padding: '24px', color: '#dc2626', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '16px' }}>
      <div style={{ maxWidth: '1580px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
          Hi, {name || 'User'}
        </h1>
        <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#475569', marginBottom: '24px' }}>
          It always seems impossible until it's done.
        </h3>
        <div style={{ maxHeight: '700px', overflowY: 'auto', paddingRight: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>
              Tasks <span style={{ fontSize: '14px', color: '#64748b' }}>({filteredTasks.length})</span>
            </h3>
            <button
              onClick={handleAddTask}
              style={{
                color: '#2563eb',
                fontSize: '14px',
                fontWeight: '500',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#1d4ed8'}
              onMouseOut={(e) => e.currentTarget.style.color = '#2563eb'}
            >
              + Add
            </button>
          </div>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                borderLeft: `4px solid ${getDueStatus(task.dueDate)}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                    {task.title}
                  </h4>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Due: {new Date(task.dueDate).toLocaleDateString()} | Start: {new Date(task.startDate).toLocaleDateString()} |{' '}
                    Expected Time: {formatExpectedTime(task.expectedMinutes)} |{' '}
                    Status: {task.status.charAt(0).toUpperCase() + task.status.slice(1)} |{' '}
                    Priority: {task.priority} |{' '}
                    Assigned to: {getUserName(task.assignedUserId)} |{' '}
                    Contact: {getContactName(task.referenceContactId || '')}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>
                    Created by: {task.createdByEmail}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={task.status}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Min"
                      value={timeInputs[task.id] || ''}
                      onChange={(e) => handleTimeInputChange(task.id, e.target.value)}
                      style={{
                        padding: '4px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        width: '60px',
                      }}
                    />
                    <button
                      onClick={() => handleSubmitTime(task.id)}
                      disabled={hasUserLoggedTime(task)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: hasUserLoggedTime(task) ? '#9ca3af' : '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        cursor: hasUserLoggedTime(task) ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseOver={(e) => !hasUserLoggedTime(task) && (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                      onMouseOut={(e) => !hasUserLoggedTime(task) && (e.currentTarget.style.backgroundColor = '#2563eb')}
                    >
                      Log
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setExpandedTasks((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(task.id)) {
                          newSet.delete(task.id);
                        } else {
                          newSet.add(task.id);
                        }
                        return newSet;
                      });
                    }}
                    style={{
                      padding: '4px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#2563eb',
                      transition: 'transform 0.2s',
                      transform: expandedTasks.has(task.id) ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
              {expandedTasks.has(task.id) && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Description: {task.description || 'No description'}
                  </p>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Links: <a href={task.links || '#'} style={{ color: '#2563eb' }}>{task.links || 'No link'}</a>
                  </p>
                  {task.referenceContactId && (
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                      Contact Phone:{' '}
                      {getUserPhone(task.referenceContactId).map((phone, index) => (
                        <span key={index}>
                          {phone && (
                            <span>
                              <a href={`tel:${phone}`} style={{ color: '#2563eb', marginRight: '8px' }}>
                                <Phone size={14} />
                              </a>
                              <a
                                href={`https://wa.me/${phone}?text=${encodeURIComponent(formatWhatsAppMessage(task))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#22c55e', marginRight: '8px' }}
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
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        marginBottom: '8px',
                      }}
                    />
                    <button
                      onClick={() => handleAddComment(task.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                    >
                      Add Comment
                    </button>
                  </div>
                  {comments[task.id] && comments[task.id].length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                        Comments
                      </h5>
                      {comments[task.id].map((comment) => (
                        <div
                          key={comment.id}
                          style={{
                            backgroundColor: '#f1f5f9',
                            padding: '8px',
                            borderRadius: '4px',
                            marginBottom: '8px',
                          }}
                        >
                          <p style={{ fontSize: '14px', color: '#64748b' }}>
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

export default Dashboard;