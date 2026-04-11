/**
 * 가족 임무(Family Tasks) 섹션 컴포넌트
 */

'use client';

import React, { useRef, useState } from 'react';
import type { FamilyTask } from '../types';
import { useFamilyTasks } from '../hooks/useFamilyTasks';

interface FamilyTasksSectionProps {
  tasks: FamilyTask[];
  onTasksChange: (tasks: FamilyTask[]) => void;
  userId: string;
  currentGroupId: string | null;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  realtimeSubscriptionId: string;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  translations: {
    todo_section_title: string;
    todo_add_btn: string;
    todo_empty_state: string;
    todo_modal_title: string;
    todo_what_label: string;
    todo_what_placeholder: string;
    todo_who_label: string;
    todo_who_placeholder: string;
    todo_register_btn: string;
    todo_required: string;
    invalid_input: string;
    anyone: string;
    cancel: string;
    delete_confirm: string;
  };
  chatDragOver: boolean;
  chatDropRef: React.RefObject<HTMLDivElement | null>;
  onChatDragOver: (e: React.DragEvent) => void;
  onChatDragLeave: () => void;
  onChatDrop: (e: React.DragEvent) => void;
}

export function FamilyTasksSection({
  tasks,
  onTasksChange,
  userId,
  currentGroupId,
  getCurrentKey,
  CryptoService,
  sanitizeInput,
  realtimeSubscriptionId,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  translations: t,
  chatDragOver,
  chatDropRef,
  onChatDragOver,
  onChatDragLeave,
  onChatDrop,
}: FamilyTasksSectionProps) {
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const todoTextRef = useRef<HTMLInputElement>(null);
  const todoWhoRef = useRef<HTMLInputElement>(null);

  const { addTask, toggleTask, deleteTask } = useFamilyTasks({
    currentGroupId,
    userId,
    getCurrentKey,
    CryptoService,
    onTasksChange,
    currentTasks: tasks,
    realtimeSubscriptionId,
  });

  const handleToggleTask = (taskId: number | string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // 낙관적 업데이트
    onTasksChange(tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)));

    // Supabase 업데이트
    toggleTask(taskId, !task.done);
  };

  const handleDeleteTask = async (taskId: number | string) => {
    if (!confirm(t.delete_confirm)) return;

    // 낙관적 업데이트
    const previousTasks = tasks;
    onTasksChange(tasks.filter((t) => t.id !== taskId));

    try {
      await deleteTask(taskId);
    } catch (error) {
      // 에러 시 롤백
      onTasksChange(previousTasks);
      alert('삭제에 실패했습니다.');
    }
  };

  const submitNewTodo = () => {
    const text = todoTextRef.current?.value;
    const who = todoWhoRef.current?.value;

    if (!text?.trim()) return alert(t.todo_required);

    const sanitizedText = sanitizeInput(text, 100);
    const sanitizedWho = sanitizeInput(who, 20);

    if (!sanitizedText) return alert(t.invalid_input);

    const textWithAssignee =
      sanitizedWho && sanitizedWho !== '누구나' ? `${sanitizedText} - ${sanitizedWho}` : sanitizedText;

    const newTask: FamilyTask = {
      id: Date.now(),
      text: textWithAssignee,
      assignee: sanitizedWho || '누구나',
      done: false,
    };

    // 낙관적 업데이트
    onTasksChange([newTask, ...tasks]);

    // Supabase 추가
    addTask({
      id: newTask.id as number,
      text: textWithAssignee,
      assignee: sanitizedWho || '누구나',
      done: false,
    });

    // Clear & Close
    if (todoTextRef.current) todoTextRef.current.value = '';
    if (todoWhoRef.current) todoWhoRef.current.value = '';
    setIsTodoModalOpen(false);
  };

  return (
    <>
      {/* Todo Modal - Chalkboard Style */}
      {isTodoModalOpen && (
        <div className="chalkboard-modal-overlay" onClick={() => setIsTodoModalOpen(false)}>
          <div className="chalkboard-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="chalkboard-modal-title">
              <span className="chalkboard-modal-icon">📝</span>
              {t.todo_modal_title}
            </h3>
            <div className="chalkboard-modal-form">
              <div className="chalkboard-form-field">
                <label className="chalkboard-form-label">{t.todo_what_label}</label>
                <input
                  ref={todoTextRef}
                  type="text"
                  className="chalkboard-form-input"
                  placeholder={t.todo_what_placeholder}
                />
              </div>
              <div className="chalkboard-form-field">
                <label className="chalkboard-form-label">{t.todo_who_label}</label>
                <input
                  ref={todoWhoRef}
                  type="text"
                  className="chalkboard-form-input"
                  placeholder={t.todo_who_placeholder}
                />
              </div>
            </div>
            <div className="chalkboard-modal-actions">
              <button onClick={() => setIsTodoModalOpen(false)} className="chalkboard-btn-secondary">
                {t.cancel}
              </button>
              <button onClick={submitNewTodo} className="chalkboard-btn-primary">
                {t.todo_register_btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Family Tasks Section - Chalkboard Style */}
      <section className="chalkboard-container">
        {/* Chalkboard Decorations - Top Right */}
        <div className="chalkboard-decorations">
          {/* House Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          {/* Sun Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          {/* Heart Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </div>

        <div className="chalkboard-header">
          <h3 className="chalkboard-title">{t.todo_section_title}</h3>
          <button onClick={() => setIsTodoModalOpen(true)} className="chalkboard-btn-add">
            {t.todo_add_btn}
          </button>
        </div>
        <div
          className="section-body"
          ref={chatDropRef}
          onDragOver={onChatDragOver}
          onDragLeave={onChatDragLeave}
          onDrop={onChatDrop}
          style={
            chatDragOver ? { outline: '2px dashed #6366f1', outlineOffset: '4px', borderRadius: '10px' } : undefined
          }
        >
          {(tasks || []).length > 0 ? (
            <div className="todo-list">
              {(tasks || []).map((task) => (
                <div key={task.id} className="todo-item">
                  <div onClick={() => handleToggleTask(task.id)} className="todo-content">
                    <div className={`todo-checkbox ${task.done ? 'todo-checkbox-checked' : ''}`}>
                      {task.done && (
                        <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                    <div className="todo-text-wrapper">
                      <span className={`todo-text ${task.done ? 'todo-text-done' : ''}`}>{task.text}</span>
                      {task.assignee && (
                        <span className="todo-assignee">
                          {task.assigned_to_user_id && familyRoleByUserId[task.assigned_to_user_id]
                            ? getFamilyRoleEmoji(familyRoleByUserId[task.assigned_to_user_id]) + ' '
                            : ''}
                          {task.assignee === '누구나' ? t.anyone : task.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                  {(task.created_by === userId || !task.created_by) && (
                    <button onClick={() => handleDeleteTask(task.id)} className="chalkboard-btn-delete">
                      <svg className="chalkboard-icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="chalkboard-empty-state">{t.todo_empty_state}</p>
          )}
        </div>
      </section>
    </>
  );
}
