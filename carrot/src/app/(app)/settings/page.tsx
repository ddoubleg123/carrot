'use client';

import { useState, useEffect, Suspense } from 'react';
import MinimalNav from '../../../components/MinimalNav';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import FirebaseClientInit from '../dashboard/components/FirebaseClientInit';
import { useSession } from 'next-auth/react';
import {
  SettingsLayout,
  AccountInformation,
  NotificationPreferences,
  PrivacySettings,
} from '../dashboard/settings/components';
import ProfileSettings from '../dashboard/settings/components/ProfileSettings';

export default function SettingsPageUnified() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Playback preferences (client-side)
  const [reducedMotion, setReducedMotion] = useState(false);
  const [captionsDefaultOn, setCaptionsDefaultOn] = useState(false);
  const [autoplayOn, setAutoplayOn] = useState(true);
  const [storageEstimate, setStorageEstimate] = useState<{usage?: number; quota?: number}>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    bio: '',
    location: '',
    displayName: ''
  });

  // Initialize form data from session
  useEffect(() => {
    const user = (session?.user || {}) as any;
    setFormData({
      fullName: user.name || '',
      email: user.email || '',
      username: user.username || '',
      phone: user.phone || '',
      bio: user.bio || '',
      location: user.location || '',
      displayName: user.displayName || user.name || ''
    });
  }, [session?.user]);

  // Initialize playback prefs from localStorage
  useEffect(() => {
    try {
      setReducedMotion(localStorage.getItem('carrot_reduced_motion') === '1');
      setCaptionsDefaultOn((localStorage.getItem('carrot_captions_default') || 'off') === 'on');
      const ap = localStorage.getItem('carrot_autoplay_default');
      setAutoplayOn(ap === 'off' ? false : true);
    } catch {}
    // Fetch server-backed prefs if available and sync to local
    (async () => {
      try {
        const res = await fetch('/api/user/prefs', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.reducedMotion === 'boolean') {
          setReducedMotion(json.reducedMotion);
          if (json.reducedMotion) localStorage.setItem('carrot_reduced_motion','1'); else localStorage.removeItem('carrot_reduced_motion');
        }
        if (json?.captionsDefault === 'on' || json?.captionsDefault === 'off') {
          setCaptionsDefaultOn(json.captionsDefault === 'on');
          localStorage.setItem('carrot_captions_default', json.captionsDefault);
        }
        if (typeof json?.autoplay === 'boolean') {
          setAutoplayOn(json.autoplay);
          localStorage.setItem('carrot_autoplay_default', json.autoplay ? 'on' : 'off');
        }
      } catch {}
    })();
    // Storage estimate (best-effort)
    (async () => {
      try {
        if ('storage' in navigator && 'estimate' in (navigator as any).storage) {
          const est = await (navigator as any).storage.estimate();
          setStorageEstimate({ usage: est.usage, quota: est.quota });
        }
      } catch {}
    })();
  }, []);

  const handleReducedMotionToggle = (checked: boolean) => {
    setReducedMotion(checked);
    try {
      if (checked) localStorage.setItem('carrot_reduced_motion', '1');
      else localStorage.removeItem('carrot_reduced_motion');
    } catch {}
    // Persist to server prefs (best-effort)
    try {
      fetch('/api/user/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reducedMotion: checked }) }).catch(() => {});
    } catch {}
  };

  const handleCaptionsDefaultToggle = (checked: boolean) => {
    setCaptionsDefaultOn(checked);
    try {
      localStorage.setItem('carrot_captions_default', checked ? 'on' : 'off');
    } catch {}
    try {
      fetch('/api/user/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captionsDefault: checked ? 'on' : 'off' }) }).catch(() => {});
    } catch {}
  };

  const handleAutoplayToggle = (checked: boolean) => {
    setAutoplayOn(checked);
    try { localStorage.setItem('carrot_autoplay_default', checked ? 'on' : 'off'); } catch {}
    try { fetch('/api/user/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoplay: checked }) }).catch(() => {}); } catch {}
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (saveError) setSaveError('');
  };

  // Media upload helper -> returns public URL and durable storage path if available
  const uploadToStorage = async (file: File): Promise<{ publicURL: string; path?: string } | null> => {
    try {
      let fileToUpload = file;
      
      // Optimize images before upload
      if (file.type.startsWith('image/')) {
        const { optimizeImage, getOptimalDimensions, isSupportedImageType } = await import('@/lib/imageOptimization');
        
        if (isSupportedImageType(file)) {
          const dimensions = getOptimalDimensions('avatar'); // Use avatar dimensions for profile images
          const optimizationResult = await optimizeImage(file, {
            maxSizeMB: dimensions.maxSizeMB,
            maxWidthOrHeight: dimensions.maxWidthOrHeight,
            quality: dimensions.quality,
            useWebWorker: true
          });
          
          fileToUpload = optimizationResult.optimizedFile;
          console.log(`Profile image optimized: ${(optimizationResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(optimizationResult.optimizedSize / 1024 / 1024).toFixed(2)}MB`);
        }
      }
      
      const maxBytes = fileToUpload.type.startsWith('image/') ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
      const pres = await fetch('/api/getPresignedURL', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: fileToUpload.type, maxBytes }),
      });
      if (!pres.ok) return null;
      const { uploadURL, publicURL, path } = await pres.json();
      const put = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': fileToUpload.type }, body: fileToUpload });
      if (!put.ok) return null;
      return { publicURL, path };
    } catch { return null; }
  };

  // Handle avatar/banner image selection from ProfileSettings
  const handleProfileImageChange = async (type: 'avatar' | 'banner', file: File) => {
    try {
      setIsSaving(true);
      const up = await uploadToStorage(file);
      if (!up) { setSaveError('Upload failed'); return; }
      if (type === 'avatar') {
        await fetch('/api/me/avatar/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: up.path || '', url: up.publicURL }) });
      } else {
        await fetch('/api/me/header/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: up.path || '', url: up.publicURL }) });
      }
    } catch (e) {
      setSaveError('Failed to update image');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUsernameChange = async (username: string) => {
    if (!session) return { success: false, message: 'Not authenticated' };
    setIsSaving(true);
    setSaveError('');
    try {
      await new Promise(r => setTimeout(r, 600));
      await update({
        ...session,
        user: { ...(session.user as any), username },
      });
      return { success: true };
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to update username');
      return { success: false, message: e?.message || 'Failed to update username' };
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update({
        ...session,
        user: {
          ...(session?.user as any),
          name: formData.fullName,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          bio: formData.bio,
          location: formData.location,
        },
      });
    } catch (e) {
      setSaveError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left sidebar (same as /home) */}
      <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-gray-50 border-r border-gray-200">
        <MinimalNav />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex">
        <div className="w-full min-w-[320px] max-w-[980px] px-6 py-6">
          <FirebaseClientInit />
          <ClientSessionProvider>
            <Suspense>
              <form onSubmit={handleSubmit} className="space-y-6">
                <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab}>
                  {activeTab === 'profile' && (
                    <ProfileSettings
                      formData={{ displayName: formData.displayName, bio: formData.bio, location: formData.location }}
                      onInputChange={handleInputChange}
                      onImageChange={handleProfileImageChange}
                    />
                  )}
                  {activeTab === 'account' && (
                    <AccountInformation
                      formData={formData}
                      onInputChange={handleInputChange}
                      onUsernameChange={handleUsernameChange}
                      isSaving={isSaving}
                      saveError={saveError}
                      setSaveError={setSaveError}
                    />
                  )}
                  {activeTab === 'notifications' && <NotificationPreferences />}
                  {activeTab === 'privacy' && <PrivacySettings />}

                  {activeTab !== 'account' && (
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </SettingsLayout>

                {/* Playback Preferences */}
                <div className="mt-8 border rounded-xl bg-white shadow-sm">
                  <div className="px-5 py-4 border-b">
                    <h2 className="text-base font-semibold text-gray-900">Playback Preferences</h2>
                    <p className="text-sm text-gray-500 mt-1">Controls for motion and captions during feed playback.</p>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Reduced motion</div>
                        <div className="text-xs text-gray-500">Disables autoplay and heavy animations. Honors your system preferences if enabled here.</div>
                      </div>
                      <label className="inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={reducedMotion} onChange={(e) => handleReducedMotionToggle(e.target.checked)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-primary-600 relative transition-colors">
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${reducedMotion ? 'translate-x-5' : ''}`}></div>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Captions default</div>
                        <div className="text-xs text-gray-500">Turn subtitles on by default for supported videos (you can still toggle in the player).</div>
                      </div>
                      <label className="inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={captionsDefaultOn} onChange={(e) => handleCaptionsDefaultToggle(e.target.checked)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-primary-600 relative transition-colors">
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${captionsDefaultOn ? 'translate-x-5' : ''}`}></div>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Autoplay</div>
                        <div className="text-xs text-gray-500">Start playback automatically when a tile becomes active (disabled if Reduced Motion is on).</div>
                      </div>
                      <label className="inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={autoplayOn} onChange={(e) => handleAutoplayToggle(e.target.checked)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-primary-600 relative transition-colors">
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoplayOn ? 'translate-x-5' : ''}`}></div>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Clear cached media</div>
                        <div className="text-xs text-gray-500">Removes preloaded HLS playlists and first segments from this device.</div>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                        onClick={async () => {
                          try {
                            if ((navigator as any)?.serviceWorker?.controller) {
                              (navigator as any).serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
                            } else if ('caches' in window) {
                              await (window as any).caches.delete('carrot-media-v1');
                            }
                            alert('Cached media cleared');
                          } catch {
                            alert('Could not clear cache. Try reloading the page.');
                          }
                        }}
                      >
                        Clear
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Reset playback profile</div>
                        <div className="text-xs text-gray-500">Clears network heuristics used for startup level and buffering (7-day profile).</div>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                        onClick={() => {
                          try {
                            localStorage.removeItem('carrot_net_profile');
                            localStorage.removeItem('carrot_net_profile_ext_v1');
                            localStorage.removeItem('carrot_net_profile_v1');
                            alert('Playback profile reset');
                          } catch {}
                        }}
                      >
                        Reset
                      </button>
                    </div>

                    <div className="text-xs text-gray-500">
                      {typeof storageEstimate.usage === 'number' && typeof storageEstimate.quota === 'number' ? (
                        <span>
                          Storage: {(storageEstimate.usage / (1024*1024)).toFixed(1)} MB used of {(storageEstimate.quota / (1024*1024)).toFixed(0)} MB
                        </span>
                      ) : (
                        <span>Storage estimate unavailable</span>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </Suspense>
          </ClientSessionProvider>
        </div>

        {/* Optional right rail, keep empty for now to match clean settings */}
        <aside className="hidden lg:block w-80 shrink-0 px-4 py-6" />
      </main>
    </div>
  );
}
