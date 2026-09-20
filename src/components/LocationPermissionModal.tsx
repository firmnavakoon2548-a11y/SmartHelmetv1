import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Smartphone,
  RefreshCw,
  X,
  Search,
  ExternalLink,
  Info
} from 'lucide-react';
import { searchPlaceNominatim } from '../services/osrmRouting';

interface LocationPermissionModalProps {
  isOpen: boolean;
  status: 'prompt' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unknown';
  isLoading: boolean;
  onRequestLocation: () => void;
  onClose: () => void;
  onSelectManualLocation: (lat: number, lng: number, placeName: string) => void;
  highContrast?: boolean;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  status,
  isLoading,
  onRequestLocation,
  onClose,
  onSelectManualLocation,
  highContrast = false,
}) => {
  const [manualQuery, setManualQuery] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  if (!isOpen) return null;

  const handleSearchManual = async (query: string) => {
    setManualQuery(query);
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearchingManual(true);
    try {
      const res = await searchPlaceNominatim(query);
      setSearchResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingManual(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl transition-all border ${
          highContrast
            ? 'bg-black border-yellow-400 text-yellow-300'
            : 'bg-[#0B132B] border-teal-500/40 text-slate-100'
        } space-y-4`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center flex-shrink-0 animate-pulse">
              <MapPin className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-lg sm:text-xl text-white flex items-center gap-2">
                ขอเปิดใช้งานตำแหน่ง (GPS)
              </h3>
              <p className="text-xs text-amber-300/90 font-medium">
                {status === 'denied'
                  ? '⚠️ เบราว์เซอร์ถูกบล็อกสิทธิ์การเข้าถึงตำแหน่ง'
                  : status === 'unavailable'
                  ? '📡 ยังไม่ได้เปิด GPS ในมือถือ หรือไม่มีสัญญาณ'
                  : '📍 จำเป็นต้องใช้ตำแหน่งจริง เพื่อเริ่มนำทางคนตาบอด'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="ปิดหน้าต่างนี้ชั่วคราว"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Purpose Explanation */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-300 space-y-1.5 leading-relaxed">
          <div className="font-bold text-teal-300 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>ทำไมต้องใช้ตำแหน่งจริง?</span>
          </div>
          <p>
            ขณะนี้แผนที่กำลังแสดงจุดเริ่มต้นเริ่มต้นที่ <strong>กรุงเทพฯ (อนุสาวรีย์ประชาธิปไตย)</strong> เนื่องจากยังไม่ได้รับพิกัดจริง 
            เพื่อให้ระบบ SafeSight นำทางและบอกทิศทางเลี้ยวตามถนนคนเดินจากตำแหน่งที่คุณอยู่จริงได้อย่างถูกต้อง กรุณากดปุ่มเปิดตำแหน่งด้านล่างครับ
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onRequestLocation}
          disabled={isLoading}
          className={`w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-xl transition transform active:scale-[0.98] ${
            isLoading
              ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-cyan-500/20'
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'กำลังค้นหาพิกัด GPS จริง...' : '📍 แตะเพื่อเปิดตำแหน่ง / ขออนุญาตทันที'}</span>
        </button>

        {/* How to enable instructions (Especially if denied or unavailable) */}
        {(status === 'denied' || status === 'unavailable' || status === 'timeout') && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs space-y-2 text-amber-200">
            <div className="font-bold text-sm text-amber-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>วิธีเปิดสิทธิ์ตำแหน่งในโทรศัพท์ / เบราว์เซอร์:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
              <li>
                <strong className="text-white">ตรวจเช็คปุ่ม GPS ในมือถือ:</strong> ปัดแถบแจ้งเตือนด้านบนมือถือลงมา แล้วแตะเปิดปุ่ม <strong>"ตำแหน่ง" (Location / GPS)</strong>
              </li>
              <li>
                <strong className="text-white">ตั้งค่าในเบราว์เซอร์:</strong> แตะไอคอนแม่กุญแจ <strong>🔒</strong> หรือไอคอน <strong>⚙️</strong> ด้านซ้ายสุดของแถบพิมพ์ URL ด้านบน
              </li>
              <li>
                เลือก <strong>"สิทธิ์ของเว็บไซต์" (Site settings/Permissions)</strong> ➜ แตะที่ <strong>"ตำแหน่ง" (Location)</strong> ➜ เลือก <strong>"อนุญาต" (Allow)</strong>
              </li>
              <li>
                เมื่อเปิดแล้ว แตะปุ่ม <strong>"แตะเพื่อเปิดตำแหน่ง"</strong> ด้านบนอีกครั้ง
              </li>
            </ol>
          </div>
        )}

        {/* Fallback: Search manual starting location */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>หรือค้นหาชื่อสถานที่ของคุณเพื่อตั้งเป็นจุดเริ่มต้นชั่วคราว:</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={manualQuery}
              onChange={(e) => handleSearchManual(e.target.value)}
              placeholder="พิมพ์ชื่อสถานที่ เช่น มหาวิทยาลัย, ตลาด, ป้ายรถเมล์..."
              className="w-full py-2.5 px-3.5 pr-8 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {isSearchingManual && (
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-3 animate-spin" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 divide-y divide-slate-800">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSelectManualLocation(item.lat, item.lng, item.name);
                    onClose();
                  }}
                  className="w-full p-2 text-left text-xs hover:bg-slate-800 flex items-start gap-2 text-slate-200 transition"
                >
                  <Navigation className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-bold text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{item.displayName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Dismiss Button */}
        <div className="pt-1 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            ข้ามไปก่อน (ใช้พิกัดเริ่มต้น)
          </button>
          <button
            onClick={onRequestLocation}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-teal-300 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>ลองเชื่อมต่ออีกครั้ง</span>
          </button>
        </div>
      </div>
    </div>
  );
};
