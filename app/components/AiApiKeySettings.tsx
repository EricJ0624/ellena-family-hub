'use client';

/**
 * 닉네임/계정 모달 — AI API 키 등록 + 가족 QR 공유(A안)
 * - 키는 localStorage at-rest 암호문
 * - QR은 3분·1회용 서버 토큰 (키 평문 없음)
 */

import React from 'react';
import QRCode from 'qrcode';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { fetchAiProxy } from '@/lib/ai-proxy-client';
import { supabase } from '@/lib/supabase';
import {
  AI_KEY_SHARE_QR_PREFIX,
  AI_KEY_SHARE_TTL_MS,
} from '@/lib/ai-key-share-constants';
import {
  clearStoredCustomMeta,
  getPreferredAiProvider,
  getStoredCustomMeta,
  hasStoredAiKey,
  maskAiKeyPreview,
  readStoredAiKeyPlain,
  removeStoredAiKey,
  setPreferredAiProvider,
  setStoredCustomMeta,
  writeStoredAiKey,
  type AiUserProvider,
} from '@/lib/ai-user-key';

const AI_PROVIDER_TABS: {
  id: AiUserProvider;
  label: string;
  activeClass: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    id: 'openai',
    label: 'GPT',
    activeClass: 'bg-green-500 text-white',
    hint: 'OpenAI API 키 (sk-...) · platform.openai.com',
    placeholder: 'sk-...',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    activeClass: 'bg-orange-500 text-white',
    hint: 'Anthropic API 키 (sk-ant-...) · console.anthropic.com',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    activeClass: 'bg-blue-500 text-white',
    hint: 'Google AI Studio 키 (AQ.… 또는 AIza…) · aistudio.google.com',
    placeholder: 'AQ.… 또는 AIza…',
  },
  {
    id: 'custom',
    label: '기타',
    activeClass: 'bg-slate-700 text-white',
    hint: 'OpenAI 호환 · Base URL + 모델명 + API 키',
    placeholder: 'API 키',
  },
];

async function authFetch(url: string, body: Record<string, unknown>): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('NO_SESSION');
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
}

export function AiApiKeySettings({
  userId,
  groupId,
}: {
  userId: string;
  groupId: string | null;
}) {
  const [activeProvider, setActiveProvider] = React.useState<AiUserProvider>(() =>
    getPreferredAiProvider(userId),
  );
  const [keyInput, setKeyInput] = React.useState('');
  const [baseUrlInput, setBaseUrlInput] = React.useState(() =>
    typeof window !== 'undefined' ? getStoredCustomMeta(userId).baseUrl : '',
  );
  const [modelInput, setModelInput] = React.useState(() =>
    typeof window !== 'undefined' ? getStoredCustomMeta(userId).model : '',
  );
  const [saved, setSaved] = React.useState(false);
  /** localStorage 키/메타 변경 시 useMemo 재계산용 */
  const [storageEpoch, setStorageEpoch] = React.useState(0);
  const [pinging, setPinging] = React.useState(false);
  const [pingResult, setPingResult] = React.useState<'ok' | 'fail' | null>(null);

  const [shareConsent, setShareConsent] = React.useState(false);
  const [shareBusy, setShareBusy] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [shareToken, setShareToken] = React.useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = React.useState<number | null>(null);
  const [shareRemainSec, setShareRemainSec] = React.useState(0);

  const [scanOpen, setScanOpen] = React.useState(false);
  const [scanBusy, setScanBusy] = React.useState(false);
  const [scanMessage, setScanMessage] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const scanControlsRef = React.useRef<{ stop: () => void } | null>(null);
  const scanHandledRef = React.useRef(false);

  const activeTab = AI_PROVIDER_TABS.find((t) => t.id === activeProvider) ?? AI_PROVIDER_TABS[0];

  const storedKey = React.useMemo(
    () => (typeof window !== 'undefined' ? readStoredAiKeyPlain(userId, activeProvider) ?? '' : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, activeProvider, saved, scanMessage, storageEpoch],
  );

  const storedCustomMeta = React.useMemo(
    () => (typeof window !== 'undefined' ? getStoredCustomMeta(userId) : { baseUrl: '', model: '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, saved, activeProvider, scanMessage, storageEpoch],
  );

  React.useEffect(() => {
    if (!shareExpiresAt) {
      setShareRemainSec(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((shareExpiresAt - Date.now()) / 1000));
      setShareRemainSec(left);
      if (left <= 0) {
        setQrDataUrl(null);
        setShareToken(null);
        setShareExpiresAt(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [shareExpiresAt]);

  const stopScanner = React.useCallback(() => {
    try {
      scanControlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    scanControlsRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    scanHandledRef.current = false;
  }, []);

  React.useEffect(() => () => stopScanner(), [stopScanner]);

  const handleProviderChange = (prov: AiUserProvider) => {
    setActiveProvider(prov);
    setKeyInput('');
    setPingResult(null);
    setSaved(false);
    if (prov === 'custom' && typeof window !== 'undefined') {
      const meta = getStoredCustomMeta(userId);
      setBaseUrlInput(meta.baseUrl);
      setModelInput(meta.model);
    } else {
      setBaseUrlInput('');
      setModelInput('');
    }
  };

  const handleSave = () => {
    const keyToSave = keyInput.trim() || storedKey;
    if (!keyToSave) return;
    if (activeProvider === 'custom') {
      const base = baseUrlInput.trim() || storedCustomMeta.baseUrl;
      if (!base) return;
      setStoredCustomMeta(userId, {
        baseUrl: base,
        model: modelInput.trim() || storedCustomMeta.model,
      });
      setBaseUrlInput(base);
      setModelInput(modelInput.trim() || storedCustomMeta.model);
    }
    if (keyInput.trim()) {
      writeStoredAiKey(userId, activeProvider, keyInput.trim());
    }
    setPreferredAiProvider(userId, activeProvider);
    window.dispatchEvent(new CustomEvent('sfh:ai-key-updated'));
    setStorageEpoch((n) => n + 1);
    setSaved(true);
    setKeyInput('');
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = () => {
    removeStoredAiKey(userId, activeProvider);
    if (activeProvider === 'custom') {
      clearStoredCustomMeta(userId);
      setBaseUrlInput('');
      setModelInput('');
    }
    window.dispatchEvent(new CustomEvent('sfh:ai-key-updated'));
    setKeyInput('');
    setPingResult(null);
    setSaved(false);
    setStorageEpoch((n) => n + 1);
  };

  const handlePing = async () => {
    const testKey = keyInput.trim() || storedKey;
    if (!testKey) return;
    if (activeProvider === 'custom') {
      const base = baseUrlInput.trim() || storedCustomMeta.baseUrl;
      if (!base) {
        setPingResult('fail');
        return;
      }
    }
    setPinging(true);
    setPingResult(null);
    try {
      const body: Record<string, unknown> = { provider: activeProvider, ping: true };
      if (activeProvider === 'custom') {
        body.baseUrl = baseUrlInput.trim() || storedCustomMeta.baseUrl;
        const model = modelInput.trim() || storedCustomMeta.model;
        if (model) body.model = model;
      }
      const res = await fetchAiProxy({ apiKey: testKey, body });
      setPingResult(res.ok ? 'ok' : 'fail');
    } catch {
      setPingResult('fail');
    } finally {
      setPinging(false);
    }
  };

  const clearShareUi = () => {
    setQrDataUrl(null);
    setShareToken(null);
    setShareExpiresAt(null);
    setShareError(null);
  };

  const handleCreateShare = async () => {
    if (!groupId) {
      setShareError('가족 그룹이 필요합니다.');
      return;
    }
    const apiKey = keyInput.trim() || storedKey;
    if (!apiKey) {
      setShareError('먼저 API 키를 등록해 주세요.');
      return;
    }
    if (!shareConsent) {
      setShareError('위 안내에 동의해 주세요.');
      return;
    }
    if (activeProvider === 'custom') {
      const base = baseUrlInput.trim() || storedCustomMeta.baseUrl;
      if (!base) {
        setShareError('기타는 Base URL이 필요합니다.');
        return;
      }
    }

    setShareBusy(true);
    setShareError(null);
    try {
      const res = await authFetch('/api/ai/key-share/create', {
        groupId,
        provider: activeProvider,
        apiKey,
        consent: true,
        ...(activeProvider === 'custom'
          ? {
              baseUrl: baseUrlInput.trim() || storedCustomMeta.baseUrl,
              model: modelInput.trim() || storedCustomMeta.model || undefined,
            }
          : {}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        qrPayload?: string;
        token?: string;
        expiresAt?: string;
      };
      if (!res.ok || !json.qrPayload || !json.token || !json.expiresAt) {
        setShareError(json.error ?? 'QR 생성에 실패했습니다.');
        return;
      }
      const dataUrl = await QRCode.toDataURL(json.qrPayload, {
        width: 220,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(dataUrl);
      setShareToken(json.token);
      setShareExpiresAt(new Date(json.expiresAt).getTime());
    } catch {
      setShareError('QR 생성 중 오류가 발생했습니다.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleCancelShare = async () => {
    if (!groupId) {
      clearShareUi();
      return;
    }
    setShareBusy(true);
    try {
      await authFetch('/api/ai/key-share/cancel', {
        groupId,
        ...(shareToken ? { token: shareToken } : {}),
      });
    } catch {
      /* ignore */
    } finally {
      clearShareUi();
      setShareBusy(false);
    }
  };

  const redeemPayload = React.useCallback(
    async (qrPayload: string) => {
      if (!groupId) {
        setScanMessage('가족 그룹이 필요합니다.');
        return;
      }

      // 서버 1회 삭제 전에 덮어쓰기 확인 (거절 시 토큰 소모 방지)
      if (hasStoredAiKey(userId) && !window.confirm('이미 등록된 AI 키가 있습니다. 스캔한 키로 덮어쓸까요?')) {
        setScanMessage('등록이 취소되었습니다. QR은 아직 유효합니다. 다시 스캔해 주세요.');
        scanHandledRef.current = false;
        return;
      }

      setScanBusy(true);
      setScanMessage(null);
      try {
        const res = await authFetch('/api/ai/key-share/redeem', {
          groupId,
          qrPayload,
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          provider?: AiUserProvider;
          apiKey?: string;
          baseUrl?: string;
          model?: string;
        };
        if (!res.ok || !json.apiKey || !json.provider) {
          setScanMessage(json.error ?? '등록에 실패했습니다.');
          scanHandledRef.current = false;
          return;
        }

        writeStoredAiKey(userId, json.provider, json.apiKey);
        if (json.provider === 'custom') {
          setStoredCustomMeta(userId, {
            baseUrl: json.baseUrl ?? '',
            model: json.model ?? '',
          });
        }
        setPreferredAiProvider(userId, json.provider);
        setActiveProvider(json.provider);
        if (json.provider === 'custom') {
          setBaseUrlInput(json.baseUrl ?? '');
          setModelInput(json.model ?? '');
        }
        window.dispatchEvent(new CustomEvent('sfh:ai-key-updated'));
        setStorageEpoch((n) => n + 1);
        setScanMessage('✅ 키가 이 기기에 등록되었습니다. (저장값은 암호화됩니다)');
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        stopScanner();
        setScanOpen(false);
      } catch {
        setScanMessage('등록 중 오류가 발생했습니다.');
        scanHandledRef.current = false;
      } finally {
        setScanBusy(false);
      }
    },
    [groupId, userId, stopScanner],
  );

  const openScanner = () => {
    if (!groupId) {
      setScanMessage('가족 그룹이 필요합니다.');
      return;
    }
    stopScanner();
    scanHandledRef.current = false;
    setScanMessage('카메라를 QR에 맞춰 주세요.');
    setScanOpen(true);
  };

  React.useEffect(() => {
    if (!scanOpen) return;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    const start = async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (!result || scanHandledRef.current || cancelled) return;
          const text = result.getText();
          if (!text.startsWith(AI_KEY_SHARE_QR_PREFIX)) return;
          scanHandledRef.current = true;
          // 카메라 정지는 redeem 성공 후에만 (덮어쓰기 거절 시 재스캔 가능)
          void redeemPayload(text);
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        scanControlsRef.current = controls;
      } catch {
        if (!cancelled) {
          setScanMessage('카메라 권한이 필요합니다. 브라우저 설정을 확인해 주세요.');
          setScanOpen(false);
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      try {
        scanControlsRef.current?.stop();
      } catch {
        /* ignore */
      }
      scanControlsRef.current = null;
      const stream = video.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [scanOpen, redeemPayload]);

  const hasKeyForActions = Boolean(keyInput.trim() || storedKey);
  const hasCustomBase = Boolean(baseUrlInput.trim() || storedCustomMeta.baseUrl);
  const canPing = hasKeyForActions && (activeProvider !== 'custom' || hasCustomBase);
  const canSave =
    activeProvider === 'custom'
      ? hasCustomBase && hasKeyForActions
      : Boolean(keyInput.trim());

  return (
    <div className="form-field">
      <label className="form-label">🤖 AI API 키 설정</label>
      <p className="text-xs text-slate-500 mb-3">
        GPT·Claude·Gemini 또는 OpenAI 호환(기타) 키를 등록하면 위젯의 AI 기능을 사용할 수 있습니다.
        <br />
        🔒 키는 이 기기에 암호화되어 저장되며 서버 DB에는 영구 저장되지 않습니다.
      </p>

      <div className="flex gap-1.5 mb-2">
        {AI_PROVIDER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleProviderChange(tab.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeProvider === tab.id
                ? tab.activeClass
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mb-3">{activeTab.hint}</p>

      {storedKey && (activeProvider !== 'custom' || storedCustomMeta.baseUrl) ? (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
          <span className="text-green-600 text-xs font-medium flex-1">
            ✅ {activeTab.label} 키 등록됨 ({maskAiKeyPreview(storedKey)})
            {activeProvider === 'custom' && storedCustomMeta.baseUrl
              ? ` · ${storedCustomMeta.baseUrl.replace(/^https?:\/\//, '').slice(0, 24)}`
              : ''}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            삭제
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400 mb-2">{activeTab.label} 키가 등록되지 않았습니다.</p>
      )}

      {activeProvider === 'custom' && (
        <>
          <input
            type="url"
            value={baseUrlInput}
            onChange={(e) => {
              setBaseUrlInput(e.target.value);
              setPingResult(null);
            }}
            placeholder="https://api.example.com/v1"
            className="form-input mb-2"
            autoComplete="off"
          />
          <input
            type="text"
            value={modelInput}
            onChange={(e) => {
              setModelInput(e.target.value);
              setPingResult(null);
            }}
            placeholder="모델명 (예: gpt-4o-mini)"
            className="form-input mb-2"
            autoComplete="off"
          />
        </>
      )}

      <input
        type="password"
        value={keyInput}
        onChange={(e) => {
          setKeyInput(e.target.value);
          setPingResult(null);
        }}
        placeholder={activeTab.placeholder}
        className="form-input mb-2"
        autoComplete="off"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePing}
          disabled={pinging || !canPing}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
        >
          {pinging ? '테스트 중...' : '연결 테스트'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
        >
          {saved ? '✅ 저장됨' : '저장'}
        </button>
      </div>

      {pingResult && (
        <p
          className={`mt-1.5 text-xs font-medium ${
            pingResult === 'ok' ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {pingResult === 'ok'
            ? '✅ 연결 성공! 키가 유효합니다.'
            : '❌ 연결 실패. 키·URL을 확인해 주세요.'}
        </p>
      )}

      {/* QR 공유 */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <p className="text-xs font-semibold text-slate-700 mb-1">가족 QR로 키 공유</p>
        <p className="text-[11px] text-slate-500 mb-2">
          QR은 키 없이 {Math.round(AI_KEY_SHARE_TTL_MS / 60000)}분·1회만 유효합니다. 가족만 앱에서
          스캔·등록할 수 있고, 등록 후 서버 임시 정보는 삭제됩니다. 사용량에 따라 AI 키 소유자
          계정에 과금될 수 있으나, 앱 청구 금액은 없습니다.
        </p>

        <label className="flex items-start gap-2 mb-2 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={shareConsent}
            onChange={(e) => setShareConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>위 안내에 동의하고 QR을 생성합니다.</span>
        </label>

        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={handleCreateShare}
            disabled={shareBusy || !groupId || !hasKeyForActions}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {shareBusy ? '생성 중…' : 'QR 생성'}
          </button>
          <button
            type="button"
            onClick={openScanner}
            disabled={!groupId || scanBusy}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            QR 스캔
          </button>
        </div>

        {!groupId && (
          <p className="text-[11px] text-amber-600 mb-2">가족 그룹에 연결된 뒤 공유·스캔할 수 있습니다.</p>
        )}
        {shareError && <p className="text-[11px] text-red-500 mb-2">{shareError}</p>}

        {qrDataUrl && (
          <div className="flex flex-col items-center gap-2 mb-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="AI 키 공유 QR" width={220} height={220} className="rounded" />
            <p className="text-xs font-medium text-slate-700">
              남은 시간 {shareRemainSec}초 · 1회용
            </p>
            <button
              type="button"
              onClick={handleCancelShare}
              disabled={shareBusy}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              공유 취소
            </button>
          </div>
        )}

        {scanOpen && (
          <div className="mb-2 p-2 rounded-lg border border-slate-200 bg-black/5">
            <video ref={videoRef} className="w-full max-h-56 rounded-lg bg-black" muted playsInline />
            <button
              type="button"
              onClick={() => {
                stopScanner();
                setScanOpen(false);
              }}
              className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700"
            >
              스캔 닫기
            </button>
          </div>
        )}
        {scanMessage && (
          <p className="text-[11px] text-slate-600 mb-1">{scanBusy ? '처리 중… ' : ''}{scanMessage}</p>
        )}
      </div>
    </div>
  );
}
