'use client';

import React, { useState } from 'react';
import { dispatchWidgetConfigsUpdated } from '@/lib/widgets/widget-config-events';

type Props = {
  currentGroupId: string | null;
  visible: boolean;
  label: string;
  failedLabel: string;
};

export function DiaryEnableWidgetCTA({ currentGroupId, visible, label, failedLabel }: Props) {
  const [loading, setLoading] = useState(false);

  if (!visible || !currentGroupId) return null;

  const onEnable = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/v1/travel/widgets/enable-travel-diary', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId: currentGroupId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      dispatchWidgetConfigsUpdated();
    } catch {
      alert(failedLabel);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 flex justify-center">
      <button
        type="button"
        disabled={loading}
        onClick={() => void onEnable()}
        className="cursor-pointer rounded-xl border-0 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
      >
        {label}
      </button>
    </div>
  );
}
