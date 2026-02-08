'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  X, 
  Copy, 
  CheckCircle, 
  RefreshCw, 
  Upload, 
  Image as ImageIcon,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';

interface GroupSettingsProps {
  onClose: () => void;
}

const GroupSettings: React.FC<GroupSettingsProps> = ({ onClose }) => {
  const { currentGroupId, currentGroup, userRole, isOwner, refreshGroups } = useGroup();
  const [groupName, setGroupName] = useState(currentGroup?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentGroup?.avatar_url || null);
  const [inviteCode, setInviteCode] = useState(currentGroup?.invite_code || '');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState<boolean>(false);
  const [checkingPermissions, setCheckingPermissions] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ SECURITY: 시스템 관리자 권한 확인 (시스템 관리자는 모든 그룹의 ADMIN 권한 자동 상속)
  useEffect(() => {
    const checkSystemAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsSystemAdmin(false);
          setCheckingPermissions(false);
          return;
        }

        const { data, error } = await supabase.rpc('is_system_admin', {
          user_id_param: user.id,
        });

        if (!error && data === true) {
          setIsSystemAdmin(true);
        }
      } catch (err) {
        console.error('시스템 관리자 권한 확인 중 오류:', err);
      } finally {
        setCheckingPermissions(false);
      }
    };

    checkSystemAdmin();
  }, []);

  // ✅ SECURITY: 권한 계층 로직 - 그룹 내 실제 역할에만 의존
  // 시스템 관리자 여부와 무관하게 해당 그룹에서 소유자 또는 ADMIN 역할이어야 함
  const isAdmin = userRole === 'ADMIN' || isOwner;

  // 아바타 파일 선택
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 검증 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setAvatarFile(file);
    setError(null);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 아바타 업로드
  const handleAvatarUpload = async (): Promise<string | null> => {
    if (!avatarFile || !currentGroupId) return null;

    setUploading(true);
    setError(null);

    try {
      // Base64로 변환
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // data:image/jpeg;base64, 부분 제거
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(avatarFile);
      });

      // API로 업로드
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('인증 정보를 가져올 수 없습니다.');
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalData: base64,
          fileName: avatarFile.name,
          mimeType: avatarFile.type,
          originalSize: avatarFile.size,
          groupId: currentGroupId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '아바타 업로드에 실패했습니다.');
      }

      // Cloudinary URL 사용 (없으면 S3 URL)
      return result.cloudinaryUrl || result.s3Url || null;
    } catch (err: any) {
      console.error('아바타 업로드 오류:', err);
      setError(err.message || '아바타 업로드에 실패했습니다.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // 그룹 설정 저장
  const handleSave = async () => {
    if (!currentGroupId || !isAdmin) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let avatarUrl = currentGroup?.avatar_url || null;

      // 아바타 업로드 (새 파일이 있는 경우)
      if (avatarFile) {
        const uploadedUrl = await handleAvatarUpload();
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        } else {
          // 업로드 실패 시 저장 중단하지 않고 계속 진행
          console.warn('아바타 업로드 실패, 기존 아바타 유지');
        }
      }

      // 그룹 정보 업데이트
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (groupName.trim() !== currentGroup?.name) {
        updates.name = groupName.trim();
      }

      if (avatarUrl && avatarUrl !== currentGroup?.avatar_url) {
        updates.avatar_url = avatarUrl;
      }

      const { error: updateError } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', currentGroupId);

      if (updateError) throw updateError;

      setSuccess('그룹 설정이 저장되었습니다.');
      
      // 그룹 목록 새로고침
      await refreshGroups();

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('그룹 설정 저장 오류:', err);
      setError(err.message || '그룹 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 초대 코드 복사
  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setError('초대 코드 복사에 실패했습니다.');
    }
  };

  // 초대 코드 갱신
  const handleRefreshInviteCode = async () => {
    if (!currentGroupId || !isAdmin) return;

    setRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: refreshError } = await supabase.rpc('refresh_invite_code', {
        group_id_param: currentGroupId,
        expires_in_days: 30, // 30일 후 만료
      });

      if (refreshError) throw refreshError;

      setInviteCode(data);
      setSuccess('초대 코드가 갱신되었습니다.');
      
      // 그룹 목록 새로고침
      await refreshGroups();

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('초대 코드 갱신 오류:', err);
      setError(err.message || '초대 코드 갱신에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  if (!currentGroupId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>그룹을 선택해주세요.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>그룹 설정은 관리자만 변경할 수 있습니다.</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">그룹 설정</h2>
            <p className="text-sm text-gray-500">
              {currentGroup?.name || '그룹 설정'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-6">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    width: '160px',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  그룹 이름
                </th>
                <td style={{ padding: '12px' }}>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setError(null);
                    }}
                    placeholder="그룹 이름을 입력하세요"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                    disabled={saving}
                  />
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  그룹 아바타
                </th>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="그룹 아바타"
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '999px',
                            objectFit: 'cover',
                            border: '2px solid #e2e8f0',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '999px',
                            background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ImageIcon style={{ width: '28px', height: '28px', color: 'white' }} />
                        </div>
                      )}
                      {uploading && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            borderRadius: '999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Loader2 style={{ width: '20px', height: '20px', color: 'white', animation: 'spin 1s linear infinite' }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarSelect}
                        style={{ display: 'none' }}
                        disabled={saving || uploading}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving || uploading}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Upload style={{ width: '16px', height: '16px' }} />
                        {avatarFile ? '파일 변경' : '이미지 선택'}
                      </button>
                      {avatarFile && (
                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          {avatarFile.name} ({(avatarFile.size / 1024).toFixed(1)}KB)
                        </p>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#475569',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  초대 코드
                </th>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={inviteCode}
                      readOnly
                      style={{
                        minWidth: '220px',
                        padding: '10px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        textAlign: 'center',
                        fontSize: '16px',
                        letterSpacing: '0.12em',
                        flex: 1,
                      }}
                    />
                    <button
                      onClick={handleCopyInviteCode}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      aria-label="초대 코드 복사"
                    >
                      {copied ? (
                        <>
                          <CheckCircle style={{ width: '16px', height: '16px' }} />
                          복사됨
                        </>
                      ) : (
                        <>
                          <Copy style={{ width: '16px', height: '16px' }} />
                          복사
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRefreshInviteCode}
                      disabled={refreshing}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: refreshing ? 0.6 : 1,
                      }}
                      aria-label="초대 코드 갱신"
                    >
                      {refreshing ? (
                        <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <RefreshCw style={{ width: '16px', height: '16px' }} />
                      )}
                      갱신
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    초대 코드를 복사하여 가족 구성원에게 공유하세요.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 성공 메시지 */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading || !groupName.trim()}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupSettings;

