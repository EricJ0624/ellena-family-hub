'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Loader2 } from 'lucide-react';
import { useGroup } from '@/app/contexts/GroupContext';

const GroupSelector: React.FC = () => {
  const { groups, currentGroupId, currentGroup, loading, setCurrentGroupId } = useGroup();
  const [isOpen, setIsOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">로딩 중...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
        가입한 그룹이 없습니다.
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full"
        aria-label="그룹 선택"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Users className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-left font-medium text-gray-900">
          {currentGroup?.name || '그룹 선택'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto"
              role="listbox"
            >
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    setCurrentGroupId(group.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    currentGroupId === group.id ? 'bg-purple-50 text-purple-900' : ''
                  }`}
                  role="option"
                  aria-selected={currentGroupId === group.id}
                >
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {group.invite_code}
                  </div>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupSelector;

