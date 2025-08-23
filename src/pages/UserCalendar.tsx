import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Phone, MessageSquareText } from 'lucide-react';
import { toast } from 'react-toastify';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  [key: string]: any;
}

interface TimeLog {
  date: string;
  minutes: number;
  userId?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assignedUserId: string;
  isPrivate: boolean;
  status: string;
  createdByEmail: string;
  priority: string;
  parentTaskId: string;
  links: string;
  referenceContactId: string;
  repeatDate: string;
  startDate: string;
  startTime: string;
  updatedAt: string;
  createdAt: string;
  timeLogs?: TimeLog[];
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export const UserCalendar = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const email = localStorage.getItem('userEmail');
  const [currentView, setCurrentView] = useState('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [showAssignedUserDropdown, setShowAssignedUserDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState<string>('');
  const [showContactDropdown, setShowContactDropdown] = useState<boolean>(false);
  const assignedUserDropdownRef = useRef<HTMLDivElement>(null);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const [timeInputs, setTimeInputs] = useState<{ [taskId: string]: string }>({});
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


  const getContactName = (id: string): string => {
    if (!id) return 'None';
    const contactIds = id.split(',').filter(cid => cid.trim());
    if (contactIds.length === 0) return 'None';
    const names = contactIds
      .map(cid => {
        const contact = contacts.find(c => c.id === cid);
        return contact?.name || 'Unknown';
      })
      .filter(name => name !== 'Unknown');
    return names.length > 0 ? names.join(', ') : 'None';
  };

  const hasUserLoggedTime = (task: Task): boolean => {
    if (!task.timeLogs || !userId) return false;
    return task.timeLogs.some((log) => log.date === today && log.userId === userId);
  };

  const handleTimeInputChange = (taskId: string, value: string) => {
    setTimeInputs((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleSubmitTime = async (taskId: string) => {
    const minutes = parseFloat(timeInputs[taskId]);
    if (isNaN(minutes) || minutes <= 0 || !userId) {
      toast.error('Please enter a valid number of minutes.');
      return;
    }

    const task = tasks.find((t) => t.id === taskId);
    const alreadyLogged = task?.timeLogs?.some((log) => log.date === today && log.userId === userId);

    if (alreadyLogged) {
      toast.error('You have already logged time for this task today.');
      return;
    }

    const taskRef = doc(db, 'tasks', taskId);
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
      setSelectedTask((prev) =>
        prev && prev.id === taskId
          ? { ...prev, timeLogs: [...(prev.timeLogs || []), newTimeLog] }
          : prev
      );
      setEditedTask((prev) =>
        prev && prev.id === taskId
          ? { ...prev, timeLogs: [...(prev.timeLogs || []), newTimeLog] }
          : prev
      );
      setTimeInputs((prev) => ({ ...prev, [taskId]: '' }));
      toast.success('Time logged successfully.');
    } catch (err) {
      console.error('Error updating time log:', err);
      toast.error('Failed to submit time.');
    }
  };

  useEffect(() => {
    if (!email) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [userSnap, tasksSnap, usersSnap, contactsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('email', '==', email))),
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'contacts')),
        ]);

        if (userSnap.empty) {
          throw new Error('User not found');
        }
        const currentUserId = userSnap.docs[0].id;
        setUserId(currentUserId);

        const allTasks = tasksSnap.docs.map((docSnap) => {
          const taskData = docSnap.data();
          return {
            id: docSnap.id,
            title: taskData.title || 'Untitled Task',
            description: taskData.description || '',
            dueDate: taskData.dueDate || new Date().toISOString(),
            assignedUserId: taskData.assignedUserId || '',
            isPrivate: taskData.isPrivate || false,
            status: taskData.status || 'pending',
            createdByEmail: taskData.createdByEmail || '',
            priority: taskData.priority || 'medium',
            links: taskData.links || '',
            referenceContactId: taskData.referenceContactId || '',
            repeatDate: taskData.repeatDate || '',
            startDate: taskData.startDate || '',
            startTime: taskData.startTime || '',
            updatedAt: taskData.updatedAt || '',
            createdAt: taskData.createdAt || '',
            timeLogs: taskData.timeLogs || [],
          };
        })
          .filter((task) => {
            const userIds = task.assignedUserId.split(',').filter((id) => id.trim());
            return userIds.includes(currentUserId) && (!task.isPrivate || task.createdByEmail === email);
          });

        const allUsers = usersSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name || 'Unknown',
          email: docSnap.data().email || '',
          phone: docSnap.data().phone || '',
        }));


        const allContacts = contactsSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name || 'Unknown',
          email: docSnap.data().email || '',
          phone: docSnap.data().phone || '',
        }));

        setTasks(allTasks);
        setUsers(allUsers);
        setContacts(allContacts);
        setFilteredTasks(allTasks);
        setError('');
      } catch (err) {
        setError('Failed to fetch data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [email, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignedUserDropdownRef.current && !assignedUserDropdownRef.current.contains(event.target as Node)) {
        setShowAssignedUserDropdown(false);
      }
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return (day + 6) % 7;
  };

  const handlePrev = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (currentView === 'month') newDate.setMonth(prev.getMonth() - 1);
      else newDate.setDate(prev.getDate() - 1);
      setSelectedDate(null);
      setSelectedTask(null);
      return newDate;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (currentView === 'month') newDate.setMonth(prev.getMonth() + 1);
      else newDate.setDate(prev.getDate() + 1);
      setSelectedDate(null);
      setSelectedTask(null);
      return newDate;
    });
  };

  const handleDayClick = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const newDate = new Date(year, month, day);
    setSelectedDate(newDate);
    setCurrentView('day');
    setCurrentDate(newDate);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setEditedTask({ ...task, referenceContactId: task.referenceContactId || '' });
    setIsEditing(false);
    setContactSearch('');
    setShowContactDropdown(false);
  };

  const closeModal = () => {
    setSelectedTask(null);
    setEditedTask(null);
    setIsEditing(false);
    setShowAssignedUserDropdown(false);
    setShowContactDropdown(false);
    setContactSearch('');
  };

  const handleEditToggle = () => {
    setIsEditing(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editedTask) return;
    const { name, value } = e.target;
    setEditedTask({ ...editedTask, [name]: value });
  };

  const handleAssignedUserToggle = (userId: string) => {
    if (!editedTask) return;
    const currentIds = editedTask.assignedUserId ? editedTask.assignedUserId.split(',').filter(id => id.trim()) : [];
    let updatedIds: string[];
    if (currentIds.includes(userId)) {
      updatedIds = currentIds.filter(id => id !== userId);
    } else {
      updatedIds = [...currentIds, userId];
    }
    setEditedTask({ ...editedTask, assignedUserId: updatedIds.join(',') });
  };

  const handleContactToggle = (contactId: string) => {
    if (!editedTask) return;
    const currentIds = editedTask.referenceContactId ? editedTask.referenceContactId.split(',').filter(id => id.trim()) : [];
    let updatedIds: string[];
    if (contactId === '') {
      updatedIds = [];
    } else if (currentIds.includes(contactId)) {
      updatedIds = currentIds.filter(id => id !== contactId);
    } else {
      updatedIds = [...currentIds, contactId];
    }
    setEditedTask({ ...editedTask, referenceContactId: updatedIds.join(',') });
    setContactSearch('');
    setShowContactDropdown(false);
  };

  const handleSave = async () => {
    if (!editedTask || !selectedTask) return;
    try {
      const taskRef = doc(db, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        title: editedTask.title,
        description: editedTask.description,
        dueDate: editedTask.dueDate,
        assignedUserId: editedTask.assignedUserId,
        priority: editedTask.priority,
        links: editedTask.links,
        referenceContactId: editedTask.referenceContactId,
        repeatDate: editedTask.repeatDate,
        startDate: editedTask.startDate,
        startTime: editedTask.startTime,
        updatedAt: new Date().toISOString(),
        isPrivate: editedTask.isPrivate,
        status: editedTask.status,
        createdByEmail: editedTask.createdByEmail,
        createdAt: editedTask.createdAt,
        timeLogs: editedTask.timeLogs || [],
      });

      setTasks(tasks.map((task) =>
        task.id === selectedTask.id ? { ...task, ...editedTask } : task
      ));
      setSelectedTask(editedTask);
      setIsEditing(false);
      setShowAssignedUserDropdown(false);
      setShowContactDropdown(false);
      setContactSearch('');
      setError('');
    } catch (err) {
      setError('Failed to update task');
      console.error(err);
    }
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInMonth = getDaysInMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = filteredTasks.filter((task) => {
        const taskDate = new Date(task.dueDate);
        return taskDate.toISOString().split('T')[0] === dateStr;
      });
      const hasParentTask = dayTasks.some(task => task.parentTaskId === "HaZuCuxBdeQgJXm2EIvu");
      const taskCount = dayTasks.length;
      const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? 'today' : ''} ${hasParentTask ? 'bg-purple-200' : taskCount > 0 ? 'bg-sky-100' : 'bg-white'} border border-gray-200 cursor-pointer p-1 sm:p-3 md:p-4 text-center min-h-[60px] sm:min-h-[100px] md:min-h-[120px] flex flex-col justify-between touch-manipulation`}
          onClick={() => handleDayClick(day)}
        >
          <div className={`font-${isToday ? 'semibold' : 'normal'} text-gray-800 text-xs sm:text-base md:text-lg`}>{day}</div>
          {taskCount > 0 && (
            <div className="text-blue-800 text-[10px] sm:text-sm mt-1 font-medium">
              {taskCount} task{taskCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1 sm:gap-4 md:gap-8 text-center">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="font-semibold text-gray-700 p-1 sm:p-2 text-[10px] sm:text-sm">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };



  const renderDayView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = filteredTasks.filter((task) => {
      const taskDate = new Date(task.dueDate);
      return taskDate.toISOString().split('T')[0] === dateStr;
    });
    const isToday = dateStr === new Date().toISOString().split('T')[0];

    const coreTimeSlots = Array.from({ length: 14 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`);
    const additionalTimeSlots = Array.from(
      new Set(
        dayTasks
          .filter((task) => {
            const taskHour = new Date(task.dueDate).getHours();
            return taskHour < 9 || taskHour >= 23;
          })
          .map((task) => {
            const taskHour = new Date(task.dueDate).getHours();
            return `${String(taskHour).padStart(2, '0')}:00`;
          })
      )
    ).sort((a, b) => parseInt(a) - parseInt(b));

    const earlyTimeSlots = additionalTimeSlots.filter((time) => parseInt(time) < 9);
    const lateTimeSlots = additionalTimeSlots.filter((time) => parseInt(time) >= 23);
    const allTimeSlots = [...earlyTimeSlots, ...coreTimeSlots, ...lateTimeSlots];

    return (
      <div className="p-2 sm:p-3 md:p-4 bg-gray-50 text-gray-800">
        <div
          className={`font-${isToday ? 'semibold' : 'normal'} text-lg sm:text-3xl md:text-4xl mb-3 sm:mb-4 text-blue-800`}
        >
          {day} {currentDate.toLocaleString('default', { month: 'long' })} {year}
        </div>
        <div className="grid grid-cols-[60px_1fr] sm:grid-cols-[100px_1fr] md:grid-cols-[120px_3fr] gap-1 sm:gap-2 md:gap-4 border border-gray-200 rounded-lg overflow-hidden">
          {allTimeSlots.length === 0 ? (
            <div className="col-span-2 p-2 sm:p-3 text-gray-600 text-[10px] sm:text-sm">
              No tasks for this day.
            </div>
          ) : (
            allTimeSlots.map((time) => {
              const slotTime = new Date(`${dateStr}T${time}:00`).getTime();
              return (
                <React.Fragment key={time}>
                  <div className="p-2 sm:p-3 border-b border-gray-200 bg-gray-100 text-right font-medium text-gray-600 text-[10px] sm:text-sm">
                    {time}
                  </div>
                  <div className="p-2 sm:p-3 border-b border-gray-200 bg-white">
                    {dayTasks
                      .filter((task) => {
                        const taskTime = new Date(task.dueDate).getTime();
                        const timeWindowStart = slotTime;
                        const timeWindowEnd = slotTime + 59 * 60 * 1000;
                        return taskTime >= timeWindowStart && taskTime < timeWindowEnd;
                      })
                      .map((task) => (
                        <div
                          key={task.id}
                          className={`${task.parentTaskId === "HaZuCuxBdeQgJXm2EIvu" ? 'bg-purple-300' : 'bg-blue-300'} text-gray-800 p-1 sm:p-2 rounded-md m-1 sm:m-2 text-[10px] sm:text-sm cursor-pointer transition-colors hover:bg-blue-200 shadow-sm touch-manipulation truncate`}
                          onClick={() => handleTaskClick(task)}
                        >
                          {task.title} (
                          {new Date(task.dueDate).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                          )
                        </div>
                      ))}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.toLocaleString('default', { month: 'long' });
    const displayDate = currentView === 'month' ? `${month} ${year}` : currentDate.toDateString();

    return (
      <div className="max-w-9xl mx-auto sm:p-6 bg-white rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-3 sm:mb-6 gap-2">
          <h2 className="text-xl sm:text-3xl font-bold text-blue-800">Calendar</h2>
          <div className="flex items-center justify-center flex-1 gap-2 sm:gap-4">
            <button
              onClick={handlePrev}
              className="px-2 sm:px-4 py-1 sm:py-2 border border-gray-200 rounded-md text-blue-800 font-medium text-[10px] sm:text-base touch-manipulation"
            >
              ←
            </button>
            <span className="text-sm sm:text-lg font-semibold text-gray-800">{displayDate}</span>
            <button
              onClick={handleNext}
              className="px-2 sm:px-4 py-1 sm:py-2 border border-gray-200 rounded-md text-blue-800 font-medium text-[10px] sm:text-base touch-manipulation"
            >
              →
            </button>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={() => {
                setCurrentView('day');
                setSelectedDate(null);
                setSelectedTask(null);
              }}
              className={`px-2 sm:px-4 py-1 sm:py-2 border border-gray-200 rounded-md font-medium text-[10px] sm:text-base ${currentView === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-blue-800'} touch-manipulation`}
            >
              Day
            </button>
            <button
              onClick={() => {
                setCurrentView('month');
                setSelectedDate(null);
                setSelectedTask(null);
              }}
              className={`px-2 sm:px-4 py-1 sm:py-2 border border-gray-200 rounded-md font-medium text-[10px] sm:text-base ${currentView === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-blue-800'} touch-manipulation`}
            >
              Month
            </button>
          </div>
        </div>
        <div className="bg-white rounded-lg p-2 sm:p-6">
          {currentView === 'month' && renderMonthView()}
          {currentView === 'day' && renderDayView()}
        </div>
        {selectedTask && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-[1000] p-4 sm:p-6"
            onClick={closeModal}
          >
            <div
              className="bg-white p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-[600px] sm:max-w-[800px] border border-gray-200 flex flex-col bg-gradient-to-b from-white to-gray-50"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg sm:text-xl font-semibold text-blue-800 border-b border-gray-200 pb-2">Task Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="mb-2">
                  <label className="font-medium text-gray-700 block mb-1 text-sm">Title</label>
                  <input
                    type="text"
                    name="title"
                    value={isEditing && editedTask ? editedTask.title : selectedTask.title}
                    onChange={isEditing ? handleInputChange : undefined}
                    readOnly={!isEditing}
                    className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                  />
                </div>
                <div className="mb-2">
                  <label className="font-medium text-gray-700 block mb-1 text-sm">Description</label>
                  <textarea
                    name="description"
                    value={isEditing && editedTask ? editedTask.description : selectedTask.description}
                    onChange={isEditing ? handleInputChange : undefined}
                    readOnly={!isEditing}
                    className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 h-16 sm:h-20 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                  />
                </div>
                <div className="mb-2">
                  <label className="font-medium text-gray-700 block mb-1 text-sm">Assigned To</label>
                  {isEditing ? (
                    <div ref={assignedUserDropdownRef} className="relative">
                      <div
                        className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setShowAssignedUserDropdown(!showAssignedUserDropdown)}
                      >
                        {editedTask?.assignedUserId ? getUserName(editedTask.assignedUserId) : 'Select users...'}
                      </div>
                      {showAssignedUserDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {users.map((user) => {
                            const isSelected = editedTask?.assignedUserId.split(',').includes(user.id);
                            return (
                              <div
                                key={user.id}
                                className={`p-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between text-sm ${isSelected ? 'bg-blue-50' : ''}`}
                                onClick={() => handleAssignedUserToggle(user.id)}
                              >
                                <span>{user.name} ({user.email})</span>
                                {isSelected && (
                                  <span className="text-blue-600">✔</span>
                                )}
                              </div>
                            );
                          })}
                          <div
                            className={`p-2 hover:bg-gray-100 cursor-pointer text-sm ${!editedTask?.assignedUserId ? 'bg-blue-50' : ''}`}
                            onClick={() => setEditedTask({ ...editedTask!, assignedUserId: '' })}
                          >
                            None
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm">
                      {selectedTask.assignedUserId
                        ? selectedTask.assignedUserId.split(',').filter((id) => id.trim()).map((userId, index) => {
                          const user = users.find((u) => u.id === userId);
                          return user ? (
                            <span key={userId} className="inline-flex items-center mr-2">
                              {index > 0 && ', '}
                              {user.name || user.email || userId}
                              {user.phone && (
                                <div className="inline-flex ml-1 gap-1">
                                  <a
                                    href={`tel:${user.phone}`}
                                    className="text-blue-600 hover:text-blue-800"
                                    title={`Call ${user.name || user.email}`}
                                  >
                                    <Phone size={12} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${user.phone}?text=${encodeURIComponent(
                                      'Regarding task: ' + (selectedTask.title || 'No title')
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-800"
                                    title={`Message ${user.name || user.email} on WhatsApp`}
                                  >
                                    <MessageSquareText size={12} />
                                  </a>
                                </div>
                              )}
                            </span>
                          ) : null;
                        })
                        : 'None'}
                    </div>
                  )}
                </div>
                <div className="mb-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="font-medium text-gray-700 block mb-1 text-sm">Due Date</label>
                      <input
                        type="date"
                        name="dueDate"
                        value={isEditing && editedTask ? new Date(editedTask.dueDate).toISOString().split('T')[0] : new Date(selectedTask.dueDate).toISOString().split('T')[0]}
                        onChange={isEditing ? handleInputChange : undefined}
                        readOnly={!isEditing}
                        className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="font-medium text-gray-700 block mb-1 text-sm">Due Time</label>
                      <input
                        type="time"
                        name="dueDate"
                        value={isEditing && editedTask ? new Date(editedTask.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date(selectedTask.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        onChange={isEditing ? (e) => {
                          if (!editedTask) return;
                          const [hours, minutes] = e.target.value.split(':');
                          const newDate = new Date(editedTask.dueDate);
                          newDate.setHours(parseInt(hours), parseInt(minutes));
                          setEditedTask({ ...editedTask, dueDate: newDate.toISOString() });
                        } : undefined}
                        readOnly={!isEditing}
                        className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
                <div className="mb-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="font-medium text-gray-700 block mb-1 text-sm">Status</label>
                      {isEditing ? (
                        <select
                          name="status"
                          value={editedTask?.status || 'pending'}
                          onChange={handleInputChange}
                          className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={
                            selectedTask.status === 'in_progress'
                              ? 'In Progress'
                              : selectedTask.status.charAt(0).toUpperCase() + selectedTask.status.slice(1)
                          }
                          readOnly
                          className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="font-medium text-gray-700 block mb-1 text-sm">Created By Email</label>
                  <input
                    type="text"
                    name="createdByEmail"
                    value={isEditing && editedTask ? editedTask.createdByEmail : selectedTask.createdByEmail}
                    onChange={isEditing ? handleInputChange : undefined}
                    readOnly={!isEditing}
                    className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                  />
                </div>
                <div className="mb-2">
                  <label className="font-medium text-gray-700 block mb-1 text-sm">Priority</label>
                  {isEditing ? (
                    <select
                      name="priority"
                      value={editedTask?.priority || 'medium'}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedTask.priority}
                      readOnly
                      className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm"
                    />
                  )}
                </div>
                <div className="mb-2">
                  <label className="font-medium text-gray-700 block mb-1 text-sm">Links</label>
                  <input
                    type="text"
                    name="links"
                    value={isEditing && editedTask ? editedTask.links : selectedTask.links}
                    onChange={isEditing ? handleInputChange : undefined}
                    readOnly={!isEditing}
                    className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                  />
                </div>
                <div className="mb-2" ref={contactDropdownRef}>
                  <label className="font-medium text-gray-700 block mb-1 text-sm">Contacts</label>
                  {isEditing ? (
                    <div className="relative">
                      <div
                        className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setShowContactDropdown(!showContactDropdown)}
                      >
                        {editedTask?.referenceContactId
                          ? getContactName(editedTask.referenceContactId)
                          : 'Select contacts...'}
                      </div>
                      {showContactDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {contacts
                            .filter(contact =>
                              contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                              contact.phone.toLowerCase().includes(contactSearch.toLowerCase())
                            )
                            .map(contact => {
                              const isSelected = editedTask?.referenceContactId.split(',').includes(contact.id);
                              return (
                                <div
                                  key={contact.id}
                                  className={`p-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between text-sm ${isSelected ? 'bg-blue-50' : ''}`}
                                  onClick={() => handleContactToggle(contact.id)}
                                >
                                  <span>{contact.name} ({contact.phone || 'No phone'})</span>
                                  {isSelected && (
                                    <span className="text-blue-600">✔</span>
                                  )}
                                </div>
                              );
                            })}
                          <div
                            className={`p-2 hover:bg-gray-100 cursor-pointer text-sm ${!editedTask?.referenceContactId ? 'bg-blue-50' : ''}`}
                            onClick={() => handleContactToggle('')}
                          >
                            None
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm">
                      {selectedTask.referenceContactId
                        ? selectedTask.referenceContactId.split(',').filter(id => id.trim()).map((contactId, index) => {
                          const contact = contacts.find(c => c.id === contactId);
                          return contact ? (
                            <span key={contactId} className="inline-flex items-center mr-2">
                              {index > 0 && ', '}
                              {contact.name}
                              {contact.phone && (
                                <div className="inline-flex ml-1 gap-1">
                                  <a
                                    href={`tel:${contact.phone}`}
                                    className="text-blue-600 hover:text-blue-800"
                                    title={`Call ${contact.name}`}
                                  >
                                    <Phone size={12} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${contact.phone}?text=${encodeURIComponent(
                                      'Regarding task: ' + (selectedTask.title || 'No title')
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-800"
                                    title={`Message ${contact.name} on WhatsApp`}
                                  >
                                    <MessageSquareText size={12} />
                                  </a>
                                </div>
                              )}
                            </span>
                          ) : null;
                        })
                        : 'None'}
                    </div>
                  )}
                </div>
                <div className="mb-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="font-medium text-gray-700 block mb-1 text-sm">Start Date</label>
                      <input
                        type="date"
                        name="startDate"
                        value={isEditing && editedTask ? editedTask.startDate : selectedTask.startDate}
                        onChange={isEditing ? handleInputChange : undefined}
                        readOnly={!isEditing}
                        className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="font-medium text-gray-700 block mb-1 text-sm">Start Time</label>
                      <input
                        type="time"
                        name="startTime"
                        value={isEditing && editedTask ? editedTask.startTime : selectedTask.startTime}
                        onChange={isEditing ? handleInputChange : undefined}
                        readOnly={!isEditing}
                        className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
                {selectedTask.status === 'in_progress' && (
                  <div className="mb-2">
                    <label className="font-medium text-gray-700 block mb-1 text-sm">Log Time (Minutes)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="Enter minutes"
                        value={timeInputs[selectedTask.id] || ''}
                        onChange={(e) => handleTimeInputChange(selectedTask.id, e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 transition-colors"
                      />
                      <button
                        onClick={() => handleSubmitTime(selectedTask.id)}
                        disabled={hasUserLoggedTime(selectedTask)}
                        className={`px-3 py-1.5 rounded-md font-medium text-sm transition-colors touch-manipulation ${hasUserLoggedTime(selectedTask)
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                      >
                        Log Time
                      </button>
                    </div>
                    {selectedTask.timeLogs && selectedTask.timeLogs.length > 0 && (
                      <p className="mt-2 text-sm text-gray-600">
                        Latest Log: {selectedTask.timeLogs[selectedTask.timeLogs.length - 1].minutes} min
                        {selectedTask.timeLogs[selectedTask.timeLogs.length - 1].minutes !== 1 ? 's' : ''} on {selectedTask.timeLogs[selectedTask.timeLogs.length - 1].date}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-medium cursor-pointer text-sm hover:bg-blue-700 transition-colors touch-manipulation"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedTask({ ...selectedTask });
                        setShowAssignedUserDropdown(false);
                        setShowContactDropdown(false);
                        setContactSearch('');
                      }}
                      className="px-3 py-1.5 bg-gray-500 text-white rounded-md font-medium cursor-pointer text-sm hover:bg-gray-600 transition-colors touch-manipulation"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {selectedTask.createdByEmail === email && (
                      <button
                        onClick={handleEditToggle}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md font-medium cursor-pointer text-sm hover:bg-blue-700 transition-colors touch-manipulation"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={closeModal}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-md font-medium cursor-pointer text-sm hover:bg-red-600 transition-colors touch-manipulation"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
              {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-2 sm:p-6 text-gray-500 text-center text-sm sm:text-base">Loading...</div>;
  if (error) return <div className="p-2 sm:p-6 text-red-500 text-center text-sm sm:text-base">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-0.5 sm:p-0.5">
      {renderCalendar()}
      {selectedTask && <div className="fixed inset-0 bg-black bg-opacity-60 z-[999]" onClick={closeModal}></div>}
    </div>
  );
};

export default UserCalendar;