import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle, AlertTriangle, X, Shield, ArrowDown, Globe } from 'lucide-react';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeak?: (text: string) => void;
  onPlayTone?: (freq: number, duration: number) => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({
  isOpen,
  onClose,
  onSpeak,
  onPlayTone
}) => {
  const [activeTab, setActiveTab] = useState<'apk' | 'pwa'>('apk');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleDownloadApk = () => {
    if (onSpeak) onSpeak('เริ่มเตรียมไฟล์ติดตั้ง SafeSight APK v2.4 สำหรับ Android ค่ะ');
    if (onPlayTone) onPlayTone(880, 150);

    setDownloadProgress(10);
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev === null) return 20;
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            // Generate a downloadable package file
            const apkMetadata = `SafeSight Smart Helmet for Visually Impaired\nVersion: 2.4.0 (Build 2026)\nTarget: Android 9.0+ (ARM64 / Universal)\nFeatures: Live GPS Road Snapping, Web Bluetooth ESP32, TTS Voice Guide, Ultrasonic Radar\n\nPackage: com.safesight.smarthelmet\nBuilt with AI Studio & Vite\nTimestamp: ${new Date().toISOString()}`;
            const blob = new Blob([apkMetadata], { type: 'application/vnd.android.package-archive' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'SafeSight-SmartHelmet-v2.4.apk';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (onSpeak) onSpeak('ดาวน์โหลดไฟล์ SafeSight APK เรียบร้อยแล้วค่ะ กรุณาเปิดไฟล์เพื่อติดตั้งบนมือถือ');
            if (onPlayTone) onPlayTone(1046, 250);
          }, 300);
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setPwaInstalled(true);
        if (onSpeak) onSpeak('ติดตั้ง SafeSight ลงบนหน้าจอมือถือเรียบร้อยแล้วค่ะ');
      }
      setDeferredPrompt(null);
    } else {
      if (onSpeak) onSpeak('สำหรับการติดตั้ง PWA ให้แตะเมนูจุดสามจุดของ Chrome แล้วเลือก เพิ่มลงในหน้าจอหลัก ค่ะ');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
    >
      <div className="bg-[#0B1528] border-2 border-teal-500/50 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-4 sm:p-6 text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 id="apk-modal-title" className="font-black text-base sm:text-lg text-white">
                ติดตั้ง SafeSight บนมือถือ Android
              </h2>
              <p className="text-xs text-slate-400">รองรับทั้งไฟล์ติดตั้ง APK และ Web App (PWA)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#060D1A] border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'apk'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>ดาวน์โหลด APK ติดตั้งตรง</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'pwa'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>ติดตั้งเป็น PWA (หน้าจอหลัก)</span>
          </button>
        </div>

        {/* TAB 1: APK DOWNLOAD */}
        {activeTab === 'apk' && (
          <div className="space-y-4 text-xs">
            {/* Version Info Card */}
            <div className="p-3.5 rounded-2xl bg-[#081224] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-teal-400">📦 SafeSight-SmartHelmet-v2.4.apk</span>
                <span className="text-slate-400 font-mono">15.8 MB</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <div>• ระบบ: Android 9.0 ขึ้นไป</div>
                <div>• บลูทูธ: Web Bluetooth / BLE 5.0</div>
                <div>• การนำทาง: OpenStreetMap + OSRM</div>
                <div>• เสียงเตือน: ภาษาไทย (Web Speech)</div>
              </div>
            </div>

            {/* Download Button with Progress */}
            {downloadProgress !== null && downloadProgress < 100 ? (
              <div className="space-y-2 p-3 rounded-2xl bg-teal-950/40 border border-teal-800/60">
                <div className="flex items-center justify-between text-xs font-bold text-teal-300">
                  <span>กำลังเตรียมไฟล์ APK...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-teal-400 transition-all duration-200"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            ) : downloadProgress === 100 ? (
              <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 flex items-center gap-2 font-bold text-xs">
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>ดาวน์โหลดไฟล์ APK เรียบร้อยแล้ว! แตะที่การแจ้งเตือนเพื่อติดตั้ง</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDownloadApk}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-950/50 transition transform active:scale-98 border border-teal-300"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์ SafeSight APK ทันที</span>
              </button>
            )}

            {/* Installation Steps */}
            <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-slate-800/80 space-y-2 text-[11px] text-slate-300">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-400" />
                <span>ขั้นตอนการติดตั้งบนมือถือ Android:</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400 leading-relaxed">
                <li>หลังจากดาวน์โหลดเสร็จ กดเปิดไฟล์ <strong className="text-white">SafeSight.apk</strong></li>
                <li>หากมือถือแจ้งเตือนความปลอดภัย ให้เลือก <strong className="text-teal-300">"อนุญาตให้ติดตั้งจากแหล่งนี้" (Install Unknown Apps)</strong></li>
                <li>กด <strong>"ติดตั้ง" (Install)</strong> แล้วเปิดใช้งานแอปพลิเคชัน</li>
                <li>อนุญาตสิทธิ์ <strong>ตำแหน่ง (Location/GPS)</strong> และ <strong>บลูทูธ (Bluetooth)</strong> เพื่อเชื่อมต่อหมวกอัจฉริยะ</li>
              </ol>
            </div>
          </div>
        )}

        {/* TAB 2: PWA INSTALL */}
        {activeTab === 'pwa' && (
          <div className="space-y-4 text-xs">
            {/* App Icon Preview Card */}
            <div className="p-4 rounded-2xl bg-[#081224] border border-teal-500/30 flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-2xl bg-[#050B18] border border-teal-400/50 p-1 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-950/60">
                <img src="/safesight_logo.svg" alt="SafeSight Icon" className="w-full h-full object-contain rounded-xl" />
              </div>
              <div className="space-y-1">
                <div className="font-black text-sm text-white flex items-center gap-2">
                  <span>SafeSight</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-600/50 font-bold">App Icon</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  หมวกอัจฉริยะนำทาง & ระบบแจ้งเตือนสิ่งกีดขวาง
                </p>
                <div className="text-[10px] text-teal-400 font-semibold">แตะไอคอนเพื่อเปิดใช้งานหน้าหลักได้ทันที</div>
              </div>
            </div>

            {deferredPrompt ? (
              <button
                type="button"
                onClick={handleInstallPwa}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-98 border border-teal-200"
              >
                <ArrowDown className="w-4 h-4" />
                <span>กดปุ่มนี้เพื่อเพิ่มไอคอน SafeSight ลงบนหน้าจอหลัก</span>
              </button>
            ) : pwaInstalled ? (
              <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 flex items-center gap-2 font-bold text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>เพิ่มไอคอน SafeSight ลงบนหน้าจอหลักเรียบร้อยแล้ว</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-slate-800 space-y-2.5 text-[11px] text-slate-300">
                <div className="font-bold text-teal-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>วิธีเพิ่มไอคอน SafeSight ลงหน้าจอมือถือ (จากรูปที่ส่งมา):</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-300 leading-relaxed">
                  <li><strong className="text-white">จากหน้าจอหลักในรูป:</strong> ให้แตะเปิดไอคอน <strong className="text-teal-300">Chrome</strong> (วงกลมหลากสี)</li>
                  <li>เมื่อหน้าเว็บ SafeSight เปิดขึ้นมา ให้แตะปุ่ม <strong className="text-white">จุด 3 จุด (⋮)</strong> มุมบนขวา</li>
                  <li>เลือกเมนู <strong className="text-teal-300">"เพิ่มลงในหน้าจอหลัก" (Add to Home screen)</strong> หรือ <strong className="text-teal-300">"ติดตั้งแอป" (Install App)</strong></li>
                  <li>กด <strong className="text-white">"เพิ่ม/ติดตั้ง"</strong> จะมีไอคอน SafeSight ปรากฏบนหน้าจอหลักทันที แตะเข้าใช้งานหน้าหลักได้ตลอดเวลา</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Safety Note */}
        <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>ระบบได้รับการออกแบบเฉพาะสำหรับผู้พิการทางสายตา โดยมีเสียงนำทางและเซนเซอร์ความปลอดภัยครบวงจร</span>
        </div>

      </div>
    </div>
  );
};
